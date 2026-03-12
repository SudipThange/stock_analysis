import json
import logging
import os
from datetime import datetime, timedelta
from urllib.request import Request, urlopen

import pandas as pd
import yfinance as yf
from django.conf import settings

logger = logging.getLogger(__name__)


def _candidate_symbols(symbol: str):
    symbol = str(symbol or "").upper().strip()
    if not symbol:
        return []
    if "." in symbol:
        return [symbol]
    # Only plain equity-style symbols should try NSE/BSE suffix expansion.
    if not symbol.isalnum():
        return [symbol]
    # Prefer Indian market listings first for plain symbols.
    return [f"{symbol}.NS", f"{symbol}.BO", symbol]


def _normalize_history_frame(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()

    work = df.copy()
    if isinstance(work.columns, pd.MultiIndex):
        work.columns = [str(col[0]) for col in work.columns]
    else:
        work.columns = [str(col) for col in work.columns]
    return work


def _normalize_price_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Return a normalized Date/Close frame or an empty frame when invalid."""
    if df is None or df.empty:
        return pd.DataFrame(columns=["Date", "Close"])

    work = _normalize_history_frame(df)
    if "Date" not in work.columns:
        work = work.reset_index()

    if "Date" not in work.columns and "Datetime" in work.columns:
        work = work.rename(columns={"Datetime": "Date"})

    if "Date" not in work.columns or "Close" not in work.columns:
        return pd.DataFrame(columns=["Date", "Close"])

    out = work[["Date", "Close"]].copy()
    out["Date"] = pd.to_datetime(out["Date"], errors="coerce").dt.date
    out["Close"] = pd.to_numeric(out["Close"], errors="coerce")
    out = out.dropna().sort_values("Date")
    return out


def _detect_currency(symbol_candidate: str, ticker_obj) -> str:
    symbol = (symbol_candidate or "").upper().strip()
    if symbol.endswith(".NS") or symbol.endswith(".BO"):
        return "INR"

    try:
        fast_info = getattr(ticker_obj, "fast_info", None)
        if isinstance(fast_info, dict):
            currency = (fast_info.get("currency") or "").upper().strip()
            if currency:
                return currency
        else:
            currency = (getattr(fast_info, "currency", None) or "").upper().strip()
            if currency:
                return currency
    except Exception:
        pass

    try:
        info = ticker_obj.info or {}
        currency = (info.get("currency") or "").upper().strip()
        if currency:
            return currency
    except Exception:
        pass

    return "USD"


def _fetch_raw_history(symbol_candidate: str, period: str, interval: str, auto_adjust: bool):
    ticker_obj = yf.Ticker(symbol_candidate)

    try:
        hist_df = ticker_obj.history(period=period, interval=interval, auto_adjust=auto_adjust)
    except Exception:
        hist_df = pd.DataFrame()

    normalized = _normalize_history_frame(hist_df)
    if not normalized.empty:
        return normalized, ticker_obj

    try:
        dl_df = yf.download(
            symbol_candidate,
            period=period,
            interval=interval,
            auto_adjust=auto_adjust,
            progress=False,
            threads=False,
        )
    except Exception:
        dl_df = pd.DataFrame()

    return _normalize_history_frame(dl_df), ticker_obj


def _fetch_usd_inr_history(start_date, end_date) -> pd.DataFrame:
    start_ts = int((datetime.combine(start_date, datetime.min.time()) - timedelta(days=7)).timestamp())
    end_ts = int((datetime.combine(end_date, datetime.min.time()) + timedelta(days=2)).timestamp())
    endpoints = [
        "https://query1.finance.yahoo.com/v8/finance/chart/INR=X",
        "https://query2.finance.yahoo.com/v8/finance/chart/INR=X",
    ]

    for base in endpoints:
        try:
            url = f"{base}?period1={start_ts}&period2={end_ts}&interval=1d&events=history"
            req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            result = (data.get("chart") or {}).get("result") or []
            if not result:
                continue

            item = result[0] or {}
            timestamps = item.get("timestamp") or []
            closes = (((item.get("indicators") or {}).get("quote") or [{}])[0]).get("close") or []
            rows = []

            for ts, close in zip(timestamps, closes):
                if close is None:
                    continue
                try:
                    d = datetime.utcfromtimestamp(int(ts)).date()
                    rows.append({"Date": d, "USDINR": float(close)})
                except Exception:
                    continue

            if rows:
                return pd.DataFrame(rows).drop_duplicates(subset=["Date"], keep="last").sort_values("Date")
        except Exception:
            continue

    return pd.DataFrame(columns=["Date", "USDINR"])


def _convert_usd_history_to_inr(frame: pd.DataFrame, price_columns=None) -> pd.DataFrame:
    if frame is None or frame.empty:
        return frame

    work = _normalize_history_frame(frame)
    idx_dt = pd.to_datetime(work.index, errors="coerce")
    valid_mask = pd.notna(idx_dt)
    if not valid_mask.any():
        return work

    if price_columns is None:
        price_columns = ["Open", "High", "Low", "Close", "Adj Close"]

    cols = [col for col in price_columns if col in work.columns]
    if not cols:
        return work

    date_series = pd.Series(idx_dt.date, index=work.index)
    valid_dates = sorted({d for d in date_series.dropna().tolist()})
    if not valid_dates:
        return work

    fx_df = _fetch_usd_inr_history(valid_dates[0], valid_dates[-1])
    if fx_df.empty:
        fallback_rate_raw = os.getenv("USD_INR_FALLBACK_RATE", "83.0")
        try:
            fallback_rate = float(fallback_rate_raw)
        except Exception:
            fallback_rate = 83.0
        logger.warning("Using fallback USD/INR rate %.4f due to FX fetch failure", fallback_rate)
        for col in cols:
            work[col] = pd.to_numeric(work[col], errors="coerce") * fallback_rate
        return work

    fx_series = pd.to_numeric(fx_df["USDINR"], errors="coerce")
    fx_lookup = pd.Series(fx_series.values, index=fx_df["Date"]).sort_index()

    all_dates = pd.Index(valid_dates)
    fx_for_dates = fx_lookup.reindex(all_dates).ffill().bfill()
    try:
        fallback_rate = float(fx_lookup.dropna().iloc[-1])
    except Exception:
        fallback_rate = 83.0
    fx_for_dates = fx_for_dates.fillna(fallback_rate)
    rates = date_series.map(fx_for_dates.to_dict())

    for col in cols:
        work[col] = pd.to_numeric(work[col], errors="coerce") * pd.to_numeric(rates, errors="coerce")
    return work


def fetch_history_with_meta(ticker: str, period: str = "1y", interval: str = "1d", auto_adjust: bool = False):
    symbol = str(ticker).upper().strip()
    last_error = None

    for candidate in _candidate_symbols(symbol):
        try:
            history, ticker_obj = _fetch_raw_history(candidate, period=period, interval=interval, auto_adjust=auto_adjust)
            if history is None or history.empty:
                continue

            currency = _detect_currency(candidate, ticker_obj)
            if currency == "USD":
                history = _convert_usd_history_to_inr(history)
                currency = "INR"

            return history, candidate, currency
        except Exception as candidate_error:
            last_error = candidate_error
            logger.warning("History candidate failed for %s (%s): %s", symbol, candidate, candidate_error)
            continue

    if last_error is not None:
        raise ValueError(
            f"No usable data for symbol (tried: {', '.join(_candidate_symbols(symbol))}). Last error: {last_error}"
        )
    raise ValueError(f"No data for symbol (tried: {', '.join(_candidate_symbols(symbol))})")


def fetch_history_in_inr(ticker: str, period: str = "1y", interval: str = "1d", auto_adjust: bool = False) -> pd.DataFrame:
    history, _, _ = fetch_history_with_meta(ticker, period=period, interval=interval, auto_adjust=auto_adjust)
    return history


def fetch_data(ticker: str) -> str:
    symbol = str(ticker).upper().strip()
    base_dir = os.path.join(settings.MEDIA_ROOT, "stock_data")
    os.makedirs(base_dir, exist_ok=True)
    out_path = os.path.join(base_dir, f"{symbol}.csv")
    try:
        selected = pd.DataFrame()
        history_error = None
        try:
            selected_history = fetch_history_in_inr(symbol, period="1y", interval="1d", auto_adjust=False)
            selected = _normalize_price_frame(selected_history)
        except Exception as fetch_error:
            history_error = fetch_error

        if selected.empty:
            # Serve cached dataset if present to avoid hard failures on transient upstream issues.
            if os.path.exists(out_path):
                try:
                    cached = _normalize_price_frame(pd.read_csv(out_path))
                    if not cached.empty:
                        logger.warning("Using cached stock data for %s after fetch failure", symbol)
                        return os.path.abspath(out_path)
                except Exception:
                    pass

            if history_error is not None:
                raise ValueError(f"Failed to fetch live data and no usable cache found: {history_error}")
            raise ValueError("No data available after fetch and normalization.")

        selected.to_csv(out_path, index=False)
        return os.path.abspath(out_path)
    except Exception as e:
        logger.error("Fetch error for %s: %s", symbol, e)
        raise
