from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import Stock
from .serializers import StockSerializer
from urllib.request import Request, urlopen
from urllib.parse import urlencode
import json
import pandas as pd
import numpy as np
import yfinance as yf
import os
from django.conf import settings
from datetime import datetime, timedelta
from django.core.cache import cache
import fetch_data as fetch_mod
import calculations as calc_mod
import save_fig as fig_mod
import save_figs as figs_mod
import forecasting as fore_mod
from .services.symbol_index import search_symbols


# ============================================
# 🔹 LIST & CREATE STOCK
# ============================================
class StockListCreateAPIView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _safe_float(value):
        try:
            if value is None or (isinstance(value, float) and np.isnan(value)):
                return None
            return round(float(value), 2)
        except Exception:
            return None

    @classmethod
    def _build_metrics(cls, ticker: str):
        try:
            hist, resolved_symbol, _ = fetch_mod.fetch_history_with_meta(
                ticker,
                period="1y",
                interval="1d",
                auto_adjust=False,
            )
        except Exception:
            return {
                "min_price": None,
                "max_price": None,
                "today_open": None,
                "today_close": None,
                "avg_price_last_month": None,
                "today_price": None,
                "pe_ratio": None,
            }

        if hist is None or hist.empty:
            return {
                "min_price": None,
                "max_price": None,
                "today_open": None,
                "today_close": None,
                "avg_price_last_month": None,
                "today_price": None,
                "pe_ratio": None,
            }

        frame = hist.copy().dropna(how="all")
        if isinstance(frame.columns, pd.MultiIndex):
            frame.columns = [str(col[0]) for col in frame.columns]

        frame = frame.reset_index()
        if "Date" not in frame.columns and "Datetime" in frame.columns:
            frame = frame.rename(columns={"Datetime": "Date"})
        if "Date" not in frame.columns:
            frame = frame.rename(columns={frame.columns[0]: "Date"})
        frame["Date"] = pd.to_datetime(frame["Date"], errors="coerce")
        frame = frame.dropna(subset=["Date"]).sort_values("Date")
        if frame.empty:
            return {
                "min_price": None,
                "max_price": None,
                "today_open": None,
                "today_close": None,
                "avg_price_last_month": None,
                "today_price": None,
                "pe_ratio": None,
            }

        latest_date = frame["Date"].iloc[-1]
        month_start = latest_date - pd.Timedelta(days=30)
        month_df = frame[frame["Date"] >= month_start]
        if month_df.empty:
            month_df = frame

        low_series = pd.to_numeric(month_df.get("Low"), errors="coerce")
        high_series = pd.to_numeric(month_df.get("High"), errors="coerce")
        close_series = pd.to_numeric(month_df.get("Close"), errors="coerce")

        latest_row = frame.iloc[-1]
        today_open = cls._safe_float(pd.to_numeric(latest_row.get("Open"), errors="coerce"))
        today_close = cls._safe_float(pd.to_numeric(latest_row.get("Close"), errors="coerce"))

        pe_ratio = None
        info = {}
        try:
            ticker_obj = yf.Ticker(resolved_symbol)
            info = ticker_obj.info or {}
            pe_ratio = cls._safe_float(info.get("trailingPE"))
        except Exception:
            pe_ratio = None

        if pe_ratio is None:
            try:
                fast_info = ticker_obj.fast_info
                if fast_info is not None:
                    pe_ratio = cls._safe_float(getattr(fast_info, "trailing_pe", None))
            except Exception:
                pe_ratio = None

        if pe_ratio is None:
            try:
                pe_ratio = cls._safe_float(info.get("forwardPE"))
            except Exception:
                pe_ratio = None

        if pe_ratio is None:
            try:
                eps = info.get("trailingEps") or info.get("epsTrailingTwelveMonths")
                eps_val = float(eps) if eps is not None else None
                close_val = float(today_close) if today_close is not None else None
                if eps_val is not None and close_val is not None and np.isfinite(eps_val) and eps_val > 0:
                    pe_ratio = cls._safe_float(close_val / eps_val)
            except Exception:
                pe_ratio = None

        return {
            "min_price": cls._safe_float(low_series.min()),
            "max_price": cls._safe_float(high_series.max()),
            "today_open": today_open,
            "today_close": today_close,
            "avg_price_last_month": cls._safe_float(close_series.mean()),
            "today_price": today_close,
            "pe_ratio": pe_ratio,
        }

    # 📌 GET → Get All Stocks
    def get(self, request):
        stocks = Stock.objects.filter(portfolio__owner=request.user).order_by('-created_at')
        portfolio_id = request.query_params.get("portfolio_id")
        if portfolio_id:
            stocks = stocks.filter(portfolio_id=portfolio_id, portfolio__owner=request.user)

        serializer = StockSerializer(stocks, many=True)
        payload = []
        for stock_obj, item in zip(stocks, serializer.data):
            enriched = dict(item)
            # Backward-compatibility for older saved plain symbols (e.g., INFY),
            # refresh displayed metrics using current INR-resolved history.
            if "." not in (stock_obj.ticker or ""):
                refreshed = self._build_metrics(stock_obj.ticker)
                for field in ("today_open", "today_close", "min_price", "max_price", "avg_price_last_month", "pe_ratio"):
                    if refreshed.get(field) is not None:
                        enriched[field] = refreshed.get(field)
            enriched["today_price"] = enriched.get("today_close")
            payload.append(enriched)

        return Response(payload, status=status.HTTP_200_OK)


    # 📌 POST → Create Stock
    def post(self, request):
        serializer = StockSerializer(data=request.data, context={'request': request})

        if serializer.is_valid():
            metrics = self._build_metrics(serializer.validated_data.get("ticker", ""))
            stock = serializer.save(
                min_price=metrics.get("min_price"),
                max_price=metrics.get("max_price"),
                today_open=metrics.get("today_open"),
                today_close=metrics.get("today_close"),
                avg_price_last_month=metrics.get("avg_price_last_month"),
                pe_ratio=metrics.get("pe_ratio"),
            )
            response_data = StockSerializer(stock).data
            response_data["today_price"] = response_data.get("today_close")
            return Response(response_data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



# ============================================
# 🔹 RETRIEVE, UPDATE, DELETE STOCK
# ============================================
class StockDetailAPIView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _safe_float(value):
        try:
            if value is None or (isinstance(value, float) and np.isnan(value)):
                return None
            return round(float(value), 2)
        except Exception:
            return None

    @classmethod
    def _live_metrics(cls, ticker: str):
        market_cap = None
        one_year_change_pct = None

        try:
            hist, resolved_symbol, _ = fetch_mod.fetch_history_with_meta(
                ticker,
                period="1y",
                interval="1d",
                auto_adjust=False,
            )
            ticker_obj = yf.Ticker(resolved_symbol)
        except Exception:
            return {
                "market_cap": None,
                "one_year_change_pct": None,
            }

        try:
            info = ticker_obj.info or {}
            market_cap = cls._safe_float(info.get("marketCap"))
        except Exception:
            market_cap = None

        if market_cap is None:
            try:
                fast_info = ticker_obj.fast_info
                if fast_info is not None:
                    market_cap = cls._safe_float(getattr(fast_info, "market_cap", None))
            except Exception:
                market_cap = None

        try:
            if hist is not None and not hist.empty:
                closes = pd.to_numeric(hist.get("Close"), errors="coerce").dropna()
                if len(closes) >= 2 and float(closes.iloc[0]) != 0.0:
                    delta = ((float(closes.iloc[-1]) - float(closes.iloc[0])) / abs(float(closes.iloc[0]))) * 100.0
                    one_year_change_pct = cls._safe_float(delta)
        except Exception:
            one_year_change_pct = None

        return {
            "market_cap": market_cap,
            "one_year_change_pct": one_year_change_pct,
        }

    def get_object(self, request, pk):
        try:
            return Stock.objects.get(pk=pk, portfolio__owner=request.user)
        except Stock.DoesNotExist:
            return None


    # 📌 GET → Get Single Stock
    def get(self, request, pk):
        stock = self.get_object(request, pk)

        if not stock:
            return Response(
                {"error": "Stock not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = StockSerializer(stock)
        payload = dict(serializer.data)
        payload.update(self._live_metrics(stock.ticker))
        return Response(payload, status=status.HTTP_200_OK)


    # 📌 PUT → Update Entire Stock
    def put(self, request, pk):
        stock = self.get_object(request, pk)

        if not stock:
            return Response(
                {"error": "Stock not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = StockSerializer(stock, data=request.data, context={'request': request})

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


    # 📌 PATCH → Partial Update
    def patch(self, request, pk):
        stock = self.get_object(request, pk)

        if not stock:
            return Response(
                {"error": "Stock not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = StockSerializer(
            stock,
            data=request.data,
            partial=True,
            context={'request': request}
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


    # 📌 DELETE → Remove Stock
    def delete(self, request, pk):
        stock = self.get_object(request, pk)

        if not stock:
            return Response(
                {"error": "Stock not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        stock.delete()
        return Response(
            {"message": "Stock deleted successfully"},
            status=status.HTTP_204_NO_CONTENT
        )


# ============================================
# 🔹 ANALYZE PORTFOLIO STOCKS
# ============================================
class StockAnalyzeAPIView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response({"message": "Deprecated. Use /api/dashboard/<ticker>/."}, status=status.HTTP_501_NOT_IMPLEMENTED)


class StockSearchAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _is_indian_equity(symbol: str, exchange: str, region: str) -> bool:
        sym = (symbol or "").upper()
        exch = (exchange or "").upper()
        reg = (region or "").upper()

        if sym.endswith(".NS") or sym.endswith(".BO"):
            return True
        if "NSE" in exch or "BSE" in exch:
            return True
        if reg in {"IN", "INDIA"}:
            return True
        return False

    @staticmethod
    def _canonical_indian_symbol(symbol: str, exchange: str) -> str:
        sym = (symbol or "").upper().strip()
        exch = (exchange or "").upper().strip()
        if not sym:
            return sym
        if "." in sym:
            return sym
        if "NSE" in exch:
            return f"{sym}.NS"
        if "BSE" in exch:
            return f"{sym}.BO"
        return sym

    @staticmethod
    def _fetch_yahoo_fallback(query: str, limit: int = 10):
        def to_suggestion(item):
            symbol_raw = (item.get("symbol") or "").upper().strip()
            if not symbol_raw:
                return None

            name = item.get("shortname") or item.get("longname") or symbol_raw
            exchange = (item.get("exchange") or "").upper().strip()
            symbol = StockSearchAPIView._canonical_indian_symbol(symbol_raw, exchange)
            if not exchange:
                if symbol.endswith(".NS"):
                    exchange = "NSE"
                elif symbol.endswith(".BO"):
                    exchange = "BSE"
            return {
                "symbol": symbol,
                "company_name": str(name).strip(),
                "exchange": exchange,
            }

        quotes = []
        try:
            search = yf.Search(query, max_results=25)
            quotes = getattr(search, "quotes", []) or []
        except Exception:
            quotes = []

        if not quotes:
            endpoints = [
                "https://query1.finance.yahoo.com/v1/finance/search",
                "https://query2.finance.yahoo.com/v1/finance/search",
            ]
            for base in endpoints:
                try:
                    url = f"{base}?{urlencode({'q': query, 'quotesCount': 25, 'newsCount': 0})}"
                    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
                    with urlopen(req, timeout=10) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                    quotes = data.get("quotes", []) or []
                    if quotes:
                        break
                except Exception:
                    continue

        suggestions = []
        seen = set()
        for quote in quotes:
            if quote.get("quoteType") != "EQUITY":
                continue
            symbol = StockSearchAPIView._canonical_indian_symbol(
                quote.get("symbol", ""),
                quote.get("exchange") or quote.get("fullExchangeName") or "",
            )
            exchange = (quote.get("exchange") or quote.get("fullExchangeName") or "").upper().strip()
            region = (quote.get("region") or "").upper().strip()
            if not StockSearchAPIView._is_indian_equity(symbol, exchange, region):
                continue
            suggestion = to_suggestion(quote)
            if suggestion is None or suggestion["symbol"] in seen:
                continue
            seen.add(suggestion["symbol"])
            suggestions.append(suggestion)
            if len(suggestions) >= limit:
                break

        return suggestions

    def get(self, request):
        query = (request.query_params.get("q") or "").strip()
        if not query:
            return Response([], status=status.HTTP_200_OK)

        cache_key = f"stock_search:{query.lower()}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached, status=status.HTTP_200_OK)

        local_results = [
            row
            for row in search_symbols(query, limit=10)
            if self._is_indian_equity(
                row.get("symbol", ""),
                row.get("exchange", ""),
                "",
            )
        ]

        merged = []
        seen_symbols = set()
        for item in local_results:
            symbol = self._canonical_indian_symbol(
                item.get("symbol", ""),
                item.get("exchange", ""),
            )
            if not symbol or symbol in seen_symbols:
                continue
            seen_symbols.add(symbol)
            merged.append(
                {
                    "symbol": symbol,
                    "company_name": item.get("company_name", symbol),
                    "exchange": (item.get("exchange") or ("NSE" if symbol.endswith(".NS") else "BSE" if symbol.endswith(".BO") else "")).upper(),
                }
            )

        if len(merged) < 5:
            yahoo_results = self._fetch_yahoo_fallback(query, limit=10)
            for item in yahoo_results:
                symbol = self._canonical_indian_symbol(
                    item.get("symbol", ""),
                    item.get("exchange", ""),
                )
                if not symbol or symbol in seen_symbols:
                    continue
                seen_symbols.add(symbol)
                merged.append(
                    {
                        "symbol": symbol,
                        "company_name": item.get("company_name", symbol),
                        "exchange": (item.get("exchange") or ("NSE" if symbol.endswith(".NS") else "BSE" if symbol.endswith(".BO") else "")).upper(),
                    }
                )
                if len(merged) >= 10:
                    break

        final_results = merged[:10]
        cache.set(cache_key, final_results, timeout=600)
        return Response(final_results, status=status.HTTP_200_OK)


class ExploreGoldSilverAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _standard_normalize(series: pd.Series) -> pd.Series:
        vals = pd.to_numeric(series, errors="coerce")
        mean = float(vals.mean())
        std = float(vals.std(ddof=0))
        if not np.isfinite(std) or std == 0.0:
            return pd.Series(np.zeros(len(vals), dtype=float), index=vals.index)
        return (vals - mean) / std

    @staticmethod
    def _fit_linear(points_df: pd.DataFrame, x_col: str, y_col: str):
        x = pd.to_numeric(points_df[x_col], errors="coerce").to_numpy(dtype=float)
        y = pd.to_numeric(points_df[y_col], errors="coerce").to_numpy(dtype=float)
        mask = np.isfinite(x) & np.isfinite(y)
        x = x[mask]
        y = y[mask]

        if x.size < 2:
            return None

        x_mean = float(np.mean(x))
        y_mean = float(np.mean(y))
        denom = float(np.sum((x - x_mean) ** 2))
        if denom == 0.0:
            return None

        slope = float(np.sum((x - x_mean) * (y - y_mean)) / denom)
        intercept = float(y_mean - slope * x_mean)

        y_pred = slope * x + intercept
        ss_res = float(np.sum((y - y_pred) ** 2))
        ss_tot = float(np.sum((y - y_mean) ** 2))
        r2 = float(1.0 - (ss_res / ss_tot)) if ss_tot != 0.0 else 1.0

        min_x = float(np.min(x))
        max_x = float(np.max(x))
        line = [
            {"x": min_x, "y": float(slope * min_x + intercept)},
            {"x": max_x, "y": float(slope * max_x + intercept)},
        ]

        return {
            "slope": slope,
            "intercept": intercept,
            "r2": r2,
            "equation": f"y = {slope:.6f}x + {intercept:.6f}",
            "line": line,
            "points_count": int(x.size),
        }

    def get(self, request):
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=365)

        try:
            gold_raw = yf.Ticker("GC=F").history(start=start_date.isoformat(), end=end_date.isoformat(), interval="1d", auto_adjust=False)
            silver_raw = yf.Ticker("SI=F").history(start=start_date.isoformat(), end=end_date.isoformat(), interval="1d", auto_adjust=False)
        except Exception as e:
            return Response({"error": f"Failed to fetch metals data: {e}"}, status=status.HTTP_502_BAD_GATEWAY)

        if gold_raw.empty or silver_raw.empty:
            return Response({"error": "No data available for gold or silver."}, status=status.HTTP_502_BAD_GATEWAY)

        gold_df = gold_raw.reset_index()[["Date", "Close"]].rename(columns={"Close": "gold_close"})
        silver_df = silver_raw.reset_index()[["Date", "Close"]].rename(columns={"Close": "silver_close"})

        gold_df["Date"] = pd.to_datetime(gold_df["Date"]).dt.date
        silver_df["Date"] = pd.to_datetime(silver_df["Date"]).dt.date

        merged = pd.merge(gold_df, silver_df, on="Date", how="inner").dropna().sort_values("Date")

        if merged.empty:
            return Response({"error": "Unable to align gold and silver time series."}, status=status.HTTP_502_BAD_GATEWAY)

        gold_base = float(merged["gold_close"].iloc[0])
        silver_base = float(merged["silver_close"].iloc[0])

        if gold_base == 0 or silver_base == 0:
            return Response({"error": "Invalid base price in metals dataset."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        merged["gold_increase_pct"] = ((merged["gold_close"] / gold_base) - 1.0) * 100.0
        merged["silver_increase_pct"] = ((merged["silver_close"] / silver_base) - 1.0) * 100.0
        merged["gold_close_z"] = self._standard_normalize(merged["gold_close"])
        merged["silver_close_z"] = self._standard_normalize(merged["silver_close"])

        growth_series = [
            {
                "date": str(row.Date),
                "gold": float(row.gold_increase_pct),
                "silver": float(row.silver_increase_pct),
            }
            for row in merged.itertuples(index=False)
        ]

        gold_vs_silver = [
            {
                "x": float(row.gold_close_z),
                "y": float(row.silver_close_z),
                "date": str(row.Date),
            }
            for row in merged.itertuples(index=False)
        ]

        silver_vs_gold = [
            {
                "x": float(row.silver_close_z),
                "y": float(row.gold_close_z),
                "date": str(row.Date),
            }
            for row in merged.itertuples(index=False)
        ]

        regression_gold_to_silver = self._fit_linear(merged, "gold_close_z", "silver_close_z")
        regression_silver_to_gold = self._fit_linear(merged, "silver_close_z", "gold_close_z")

        return Response(
            {
                "from": str(merged["Date"].iloc[0]),
                "to": str(merged["Date"].iloc[-1]),
                "growth_series": growth_series,
                "normalization": "standard",
                "gold_vs_silver": gold_vs_silver,
                "silver_vs_gold": silver_vs_gold,
                "regression_gold_to_silver": regression_gold_to_silver,
                "regression_silver_to_gold": regression_silver_to_gold,
            },
            status=status.HTTP_200_OK,
        )


class CompareStocksAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _safe_float(value):
        try:
            if value is None or (isinstance(value, float) and np.isnan(value)):
                return None
            return round(float(value), 2)
        except Exception:
            return None

    @staticmethod
    def _load_month_series(ticker: str) -> pd.DataFrame:
        raw = fetch_mod.fetch_history_in_inr(ticker, period="1y", interval="1d", auto_adjust=False)
        if raw is None or raw.empty:
            return pd.DataFrame(columns=["Date", "Close"])

        frame = raw.reset_index().copy()
        if "Date" not in frame.columns and "Datetime" in frame.columns:
            frame = frame.rename(columns={"Datetime": "Date"})
        if "Date" not in frame.columns:
            frame = frame.rename(columns={frame.columns[0]: "Date"})
        frame = frame[["Date", "Close"]].dropna().copy()
        frame["Date"] = pd.to_datetime(frame["Date"]).dt.date
        frame["Close"] = pd.to_numeric(frame["Close"], errors="coerce")
        frame = frame.dropna(subset=["Close"]).sort_values("Date")
        if frame.empty:
            return frame

        return frame.sort_values("Date")

    @classmethod
    def _fit_next_day_prediction(cls, frame: pd.DataFrame):
        y = pd.to_numeric(frame["Close"], errors="coerce").to_numpy(dtype=float)
        y = y[np.isfinite(y)]
        if y.size < 2:
            return None

        x = np.arange(y.size, dtype=float)
        x_mean = float(np.mean(x))
        y_mean = float(np.mean(y))
        denom = float(np.sum((x - x_mean) ** 2))
        if denom == 0.0:
            return None

        slope = float(np.sum((x - x_mean) * (y - y_mean)) / denom)
        intercept = float(y_mean - slope * x_mean)
        y_pred = slope * x + intercept
        ss_res = float(np.sum((y - y_pred) ** 2))
        ss_tot = float(np.sum((y - y_mean) ** 2))
        r2 = float(1.0 - (ss_res / ss_tot)) if ss_tot != 0.0 else 1.0
        next_day = float(slope * float(y.size) + intercept)

        return {
            "slope": cls._safe_float(slope),
            "intercept": cls._safe_float(intercept),
            "r2": cls._safe_float(r2),
            "prediction_next_day": cls._safe_float(next_day),
            "equation": f"y = {slope:.6f}x + {intercept:.6f}",
            "points_count": int(y.size),
        }

    def get(self, request):
        portfolio_id = request.query_params.get("portfolio_id")
        stock1_id = request.query_params.get("stock1_id")
        stock2_id = request.query_params.get("stock2_id")

        if not portfolio_id or not stock1_id or not stock2_id:
            return Response({"error": "portfolio_id, stock1_id and stock2_id are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            portfolio_id = int(portfolio_id)
            stock1_id = int(stock1_id)
            stock2_id = int(stock2_id)
        except Exception:
            return Response({"error": "Invalid numeric parameters."}, status=status.HTTP_400_BAD_REQUEST)

        if stock1_id == stock2_id:
            return Response({"error": "Please select two different stocks."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            stock1 = Stock.objects.get(id=stock1_id, portfolio_id=portfolio_id, portfolio__owner=request.user)
            stock2 = Stock.objects.get(id=stock2_id, portfolio_id=portfolio_id, portfolio__owner=request.user)
        except Stock.DoesNotExist:
            return Response({"error": "Stocks not found in selected portfolio."}, status=status.HTTP_404_NOT_FOUND)

        try:
            df1 = self._load_month_series(stock1.ticker)
            df2 = self._load_month_series(stock2.ticker)
        except Exception as e:
            return Response({"error": f"Failed to fetch stock data: {e}"}, status=status.HTTP_502_BAD_GATEWAY)

        if df1.empty or df2.empty:
            return Response({"error": "Not enough data for one or both selected stocks."}, status=status.HTTP_502_BAD_GATEWAY)

        merged = pd.merge(
            df1.rename(columns={"Close": "close1"}),
            df2.rename(columns={"Close": "close2"}),
            on="Date",
            how="inner",
        ).dropna().sort_values("Date")

        if merged.shape[0] < 2:
            return Response({"error": "Unable to align enough overlapping data points."}, status=status.HTTP_502_BAD_GATEWAY)

        base1 = float(merged["close1"].iloc[0])
        base2 = float(merged["close2"].iloc[0])
        if base1 == 0.0 or base2 == 0.0:
            return Response({"error": "Invalid base price in data series."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        merged["growth1"] = ((merged["close1"] / base1) - 1.0) * 100.0
        merged["growth2"] = ((merged["close2"] / base2) - 1.0) * 100.0

        growth_series = [
            {
                "date": str(row.Date),
                "stock1_growth": self._safe_float(row.growth1),
                "stock2_growth": self._safe_float(row.growth2),
            }
            for row in merged.itertuples(index=False)
        ]

        reg1 = self._fit_next_day_prediction(df1)
        reg2 = self._fit_next_day_prediction(df2)

        return Response(
            {
                "from": str(merged["Date"].iloc[0]),
                "to": str(merged["Date"].iloc[-1]),
                "portfolio_id": portfolio_id,
                "stock1": {
                    "id": stock1.id,
                    "title": stock1.title,
                    "ticker": stock1.ticker,
                    "today_price": self._safe_float(df1["Close"].iloc[-1]),
                    "regression": reg1,
                },
                "stock2": {
                    "id": stock2.id,
                    "title": stock2.title,
                    "ticker": stock2.ticker,
                    "today_price": self._safe_float(df2["Close"].iloc[-1]),
                    "regression": reg2,
                },
                "growth_series": growth_series,
            },
            status=status.HTTP_200_OK,
        )


class StockRiskCategorizationAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _safe_float(value):
        try:
            if value is None or (isinstance(value, float) and np.isnan(value)):
                return None
            return round(float(value), 2)
        except Exception:
            return None

    @staticmethod
    def _fetch_feature_row(stock: Stock):
        try:
            history = fetch_mod.fetch_history_in_inr(stock.ticker, period="1y", interval="1d", auto_adjust=False)
        except Exception:
            return None

        if history is None or history.empty:
            return None

        close = pd.to_numeric(history.get("Close"), errors="coerce").dropna()
        if close.empty or close.shape[0] < 30:
            return None

        returns = close.pct_change().replace([np.inf, -np.inf], np.nan).dropna()
        if returns.empty:
            return None

        rolling_max = close.cummax()
        drawdown = (close / rolling_max) - 1.0
        max_drawdown = float(abs(drawdown.min())) if not drawdown.empty else 0.0

        volatility = float(returns.std(ddof=0) * np.sqrt(252))
        downside_ratio = float((returns < 0).mean())
        six_month_return = float((close.iloc[-1] / close.iloc[0]) - 1.0)

        return {
            "id": stock.id,
            "name": stock.title,
            "ticker_id": stock.ticker,
            "closing_price": float(close.iloc[-1]),
            "volatility": volatility,
            "max_drawdown": max_drawdown,
            "downside_ratio": downside_ratio,
            "return_6m": six_month_return,
        }

    @staticmethod
    def _pseudo_labels(feature_df: pd.DataFrame) -> np.ndarray:
        risk_score = (
            feature_df["volatility"] * 0.5
            + feature_df["max_drawdown"] * 0.35
            + feature_df["downside_ratio"] * 0.15
            - feature_df["return_6m"] * 0.2
        )

        if risk_score.nunique() <= 1:
            return np.full(shape=(risk_score.shape[0],), fill_value=1, dtype=int)

        low_threshold = float(risk_score.quantile(0.33))
        high_threshold = float(risk_score.quantile(0.67))

        labels = np.where(
            risk_score <= low_threshold,
            0,
            np.where(risk_score >= high_threshold, 2, 1),
        )
        return labels.astype(int)

    @staticmethod
    def _softmax(values: np.ndarray) -> np.ndarray:
        shifted = values - np.max(values, axis=1, keepdims=True)
        exps = np.exp(shifted)
        sums = np.sum(exps, axis=1, keepdims=True)
        return exps / np.maximum(sums, 1e-12)

    @classmethod
    def _fit_multinomial_logistic(cls, x: np.ndarray, y: np.ndarray, classes_count: int = 3):
        sample_count, feature_count = x.shape
        if sample_count == 0:
            return np.zeros((feature_count, classes_count), dtype=float), np.zeros((1, classes_count), dtype=float)

        weights = np.zeros((feature_count, classes_count), dtype=float)
        bias = np.zeros((1, classes_count), dtype=float)

        one_hot = np.zeros((sample_count, classes_count), dtype=float)
        one_hot[np.arange(sample_count), y] = 1.0

        learning_rate = 0.1
        reg = 0.01

        for _ in range(600):
            logits = x @ weights + bias
            probs = cls._softmax(logits)

            grad_w = (x.T @ (probs - one_hot)) / sample_count + reg * weights
            grad_b = np.mean(probs - one_hot, axis=0, keepdims=True)

            weights -= learning_rate * grad_w
            bias -= learning_rate * grad_b

        return weights, bias

    def get(self, request):
        portfolio_id = request.query_params.get("portfolio_id")
        q = (request.query_params.get("q") or "").strip().lower()

        if not portfolio_id:
            return Response({"error": "portfolio_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            portfolio_id_int = int(portfolio_id)
        except Exception:
            return Response({"error": "portfolio_id must be a valid integer."}, status=status.HTTP_400_BAD_REQUEST)

        stocks = Stock.objects.filter(portfolio_id=portfolio_id_int, portfolio__owner=request.user).order_by("id")
        if not stocks.exists():
            return Response({"results": [], "count": 0}, status=status.HTTP_200_OK)

        rows = []
        for stock in stocks:
            feature_row = self._fetch_feature_row(stock)
            if feature_row is not None:
                rows.append(feature_row)

        if not rows:
            return Response({"results": [], "count": 0}, status=status.HTTP_200_OK)

        frame = pd.DataFrame(rows)
        feature_columns = ["volatility", "max_drawdown", "downside_ratio", "return_6m"]

        x_raw = frame[feature_columns].to_numpy(dtype=float)
        means = np.mean(x_raw, axis=0)
        stds = np.std(x_raw, axis=0)
        stds[stds == 0.0] = 1.0
        x = (x_raw - means) / stds

        y = self._pseudo_labels(frame)

        has_all_classes = len(set(y.tolist())) == 3 and frame.shape[0] >= 3
        if has_all_classes:
            weights, bias = self._fit_multinomial_logistic(x, y, classes_count=3)
            probs = self._softmax(x @ weights + bias)
            pred_labels = np.argmax(probs, axis=1)
        else:
            pred_labels = y

        label_map = {0: "low", 1: "mid", 2: "high"}

        response_rows = []
        for idx, record in frame.iterrows():
            predicted = int(pred_labels[idx])
            item = {
                "name": str(record["name"]),
                "ticker_id": str(record["ticker_id"]),
                "closing_price": self._safe_float(record["closing_price"]),
                "investment_risk_status": label_map.get(predicted, "mid"),
            }

            if q:
                text = f"{item['name']} {item['ticker_id']}".lower()
                if q not in text:
                    continue

            response_rows.append(item)

        return Response(
            {
                "results": response_rows,
                "count": len(response_rows),
            },
            status=status.HTTP_200_OK,
        )


class StockPortfolioClusterAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _safe_float(value):
        try:
            if value is None or (isinstance(value, float) and np.isnan(value)):
                return None
            return round(float(value), 6)
        except Exception:
            return None

    @staticmethod
    def _fetch_feature_row(stock: Stock):
        try:
            history = fetch_mod.fetch_history_in_inr(stock.ticker, period="1y", interval="1d", auto_adjust=False)
        except Exception:
            history = None

        close = pd.Series(dtype=float)
        volume = pd.Series(dtype=float)

        if history is not None and not history.empty:
            close = pd.to_numeric(history.get("Close"), errors="coerce").dropna()
            volume = pd.to_numeric(history.get("Volume"), errors="coerce").dropna()

        returns = close.pct_change().replace([np.inf, -np.inf], np.nan).dropna() if not close.empty else pd.Series(dtype=float)
        downside_returns = returns[returns < 0] if not returns.empty else pd.Series(dtype=float)

        rolling_max = close.cummax() if not close.empty else pd.Series(dtype=float)
        drawdown = ((close / rolling_max) - 1.0).replace([np.inf, -np.inf], np.nan).dropna() if not close.empty else pd.Series(dtype=float)

        close_count = int(close.shape[0])
        six_month_window = 126
        momentum_window = 30

        six_month_return = None
        if close_count > six_month_window:
            six_month_return = float((close.iloc[-1] / close.iloc[-six_month_window]) - 1.0)
        elif close_count > 1:
            six_month_return = float((close.iloc[-1] / close.iloc[0]) - 1.0)

        momentum_30d = None
        if close_count > momentum_window:
            momentum_30d = float((close.iloc[-1] / close.iloc[-momentum_window]) - 1.0)
        elif close_count > 1:
            momentum_30d = float((close.iloc[-1] / close.iloc[0]) - 1.0)

        annualized_volatility = float(returns.std(ddof=0) * np.sqrt(252)) if not returns.empty else None
        downside_volatility = float(downside_returns.std(ddof=0) * np.sqrt(252)) if not downside_returns.empty else None
        max_drawdown = float(abs(drawdown.min())) if not drawdown.empty else None
        avg_volume_3m = float(volume.tail(63).mean()) if not volume.empty else None

        range_ratio = None
        if stock.min_price not in (None, 0) and stock.max_price is not None:
            try:
                range_ratio = float((float(stock.max_price) - float(stock.min_price)) / float(stock.min_price))
            except Exception:
                range_ratio = None

        price_to_avg_month = None
        if stock.avg_price_last_month not in (None, 0) and stock.today_close is not None:
            try:
                price_to_avg_month = float(float(stock.today_close) / float(stock.avg_price_last_month))
            except Exception:
                price_to_avg_month = None

        return {
            "stock_id": stock.id,
            "name": stock.title,
            "ticker_id": stock.ticker,
            "annualized_volatility": annualized_volatility,
            "downside_volatility": downside_volatility,
            "max_drawdown": max_drawdown,
            "return_6m": six_month_return,
            "momentum_30d": momentum_30d,
            "avg_volume_3m": avg_volume_3m,
            "pe_ratio": float(stock.pe_ratio) if stock.pe_ratio is not None else None,
            "range_ratio": range_ratio,
            "price_to_avg_month": price_to_avg_month,
        }

    @staticmethod
    def _select_important_columns(feature_df: pd.DataFrame, candidate_columns, max_cols: int = 6):
        scored = []
        for col in candidate_columns:
            if col not in feature_df.columns:
                continue

            series = pd.to_numeric(feature_df[col], errors="coerce")
            if series.notna().sum() < 2:
                continue

            filled = series.fillna(series.median())
            variance = float(filled.var(ddof=0))
            if np.isfinite(variance) and variance > 0:
                scored.append((col, variance))

        scored.sort(key=lambda item: item[1], reverse=True)
        selected = [name for name, _ in scored[:max_cols]]

        if not selected:
            for col in candidate_columns:
                series = pd.to_numeric(feature_df.get(col), errors="coerce")
                if series.notna().sum() >= 2:
                    selected.append(col)
                if len(selected) >= min(2, len(candidate_columns)):
                    break

        return selected

    @staticmethod
    def _normalize_features(feature_df: pd.DataFrame, selected_columns):
        selected_frame = feature_df[selected_columns].apply(pd.to_numeric, errors="coerce")
        medians = selected_frame.median(numeric_only=True)
        selected_frame = selected_frame.fillna(medians)

        x_raw = selected_frame.to_numpy(dtype=float)
        means = np.mean(x_raw, axis=0)
        stds = np.std(x_raw, axis=0)
        stds[stds == 0.0] = 1.0
        normalized = (x_raw - means) / stds

        stats = {
            "means": {selected_columns[i]: float(means[i]) for i in range(len(selected_columns))},
            "stds": {selected_columns[i]: float(stds[i]) for i in range(len(selected_columns))},
        }
        return normalized, stats, selected_frame

    @staticmethod
    def _compute_pca_2d(normalized: np.ndarray) -> np.ndarray:
        if normalized.size == 0:
            return np.empty((0, 2), dtype=float)

        sample_count, feature_count = normalized.shape
        if feature_count == 1:
            return np.column_stack([normalized[:, 0], np.zeros(sample_count)])

        _, _, vt = np.linalg.svd(normalized, full_matrices=False)
        components = vt[:2].T
        transformed = normalized @ components

        if transformed.shape[1] == 1:
            transformed = np.column_stack([transformed[:, 0], np.zeros(sample_count)])

        return transformed[:, :2]

    @staticmethod
    def _compute_pca_components(normalized: np.ndarray, components_count: int) -> np.ndarray:
        if normalized.size == 0:
            return np.empty((0, 1), dtype=float)

        sample_count, feature_count = normalized.shape
        effective_components = max(1, min(components_count, feature_count, sample_count))

        _, _, vt = np.linalg.svd(normalized, full_matrices=False)
        components = vt[:effective_components].T
        transformed = normalized @ components
        return transformed

    @staticmethod
    def _compute_umap_2d(pca_embedding: np.ndarray):
        sample_count = pca_embedding.shape[0]
        if sample_count == 0:
            return np.empty((0, 2), dtype=float), "pca_fallback"

        if sample_count < 4:
            return pca_embedding, "pca_fallback"

        try:
            import importlib

            umap_module = importlib.import_module("umap")
            n_neighbors = max(2, min(10, sample_count - 1))
            reducer = umap_module.UMAP(
                n_components=2,
                n_neighbors=n_neighbors,
                min_dist=0.15,
                metric="euclidean",
                random_state=42,
            )
            embedding = reducer.fit_transform(pca_embedding)
            if embedding.shape[1] == 1:
                embedding = np.column_stack([embedding[:, 0], np.zeros(sample_count)])
            return embedding[:, :2], "umap"
        except Exception:
            return pca_embedding, "pca_fallback"

    @staticmethod
    def _kmeans(points: np.ndarray, clusters_count: int, max_iter: int = 120):
        sample_count = points.shape[0]
        if sample_count == 0:
            return np.array([], dtype=int)

        if sample_count == 1:
            return np.array([0], dtype=int)

        clusters_count = max(1, min(int(clusters_count), sample_count))
        if clusters_count == 1:
            return np.zeros(sample_count, dtype=int)

        norms = np.sum(points ** 2, axis=1)
        seed_indices = np.argsort(norms)
        chosen_idx = np.linspace(0, sample_count - 1, clusters_count, dtype=int)
        centroids = points[seed_indices[chosen_idx]].copy()
        labels = np.zeros(sample_count, dtype=int)

        for _ in range(max_iter):
            distances = np.sqrt(((points[:, None, :] - centroids[None, :, :]) ** 2).sum(axis=2))
            next_labels = np.argmin(distances, axis=1)

            if np.array_equal(next_labels, labels):
                break

            labels = next_labels
            for cluster_id in range(clusters_count):
                members = points[labels == cluster_id]
                if members.shape[0] > 0:
                    centroids[cluster_id] = np.mean(members, axis=0)

        return labels

    @classmethod
    def _cluster_labels(
        cls,
        points: np.ndarray,
        clusters_count: int,
        *,
        n_init: int = 25,
        max_iter: int = 500,
        init: str = "k-means++",
        random_state: int = 42,
    ):
        sample_count = points.shape[0]
        if sample_count == 0:
            return np.array([], dtype=int)

        effective_clusters = max(1, min(int(clusters_count), sample_count))
        if effective_clusters == 1:
            return np.zeros(sample_count, dtype=int)

        try:
            import importlib

            sklearn_cluster = importlib.import_module("sklearn.cluster")
            model = sklearn_cluster.KMeans(
                n_clusters=effective_clusters,
                random_state=int(random_state),
                n_init=int(n_init),
                max_iter=int(max_iter),
                init=str(init),
            )
            labels = model.fit_predict(points)
            return labels.astype(int)
        except Exception:
            return cls._kmeans(points, effective_clusters)

    @classmethod
    def _tune_kmeans(cls, points: np.ndarray, min_k: int = 2, max_k: int = 6):
        sample_count = points.shape[0]
        if sample_count == 0:
            return np.array([], dtype=int), {
                "k": 0,
                "strategy": "empty",
                "silhouette": None,
                "inertia": None,
                "params": {},
            }

        if sample_count == 1:
            return np.array([0], dtype=int), {
                "k": 1,
                "strategy": "single_sample",
                "silhouette": None,
                "inertia": 0.0,
                "params": {"n_init": 1, "max_iter": 1, "init": "fallback"},
            }

        upper_k = min(max_k, sample_count - 1)
        lower_k = min_k
        if upper_k < lower_k:
            fallback_k = int(max(1, min(sample_count, lower_k)))
            labels = cls._cluster_labels(points, fallback_k)
            return labels, {
                "k": int(fallback_k),
                "strategy": "bounded_fallback",
                "silhouette": None,
                "inertia": None,
                "params": {"n_init": 25, "max_iter": 500, "init": "k-means++"},
            }

        candidate_ks = list(range(lower_k, upper_k + 1))
        n_init_values = [10, 25, 40]
        max_iter_values = [300, 500]
        init_values = ["k-means++", "random"]

        best_by_k = {}

        try:
            import importlib

            sklearn_cluster = importlib.import_module("sklearn.cluster")
            sklearn_metrics = importlib.import_module("sklearn.metrics")

            for k in candidate_ks:
                for init in init_values:
                    for n_init in n_init_values:
                        for max_iter in max_iter_values:
                            model = sklearn_cluster.KMeans(
                                n_clusters=int(k),
                                random_state=42,
                                n_init=int(n_init),
                                max_iter=int(max_iter),
                                init=str(init),
                            )
                            labels = model.fit_predict(points).astype(int)
                            unique_labels = sorted({int(x) for x in labels.tolist()})
                            if len(unique_labels) < 2:
                                continue

                            score = float(sklearn_metrics.silhouette_score(points, labels, metric="euclidean"))
                            if not np.isfinite(score):
                                continue

                            inertia = float(model.inertia_) if np.isfinite(model.inertia_) else float("inf")

                            current = best_by_k.get(int(k))
                            if current is None or score > current["score"] + 1e-9 or (
                                abs(score - current["score"]) <= 1e-9 and inertia < current["inertia"]
                            ):
                                best_by_k[int(k)] = {
                                    "score": score,
                                    "inertia": inertia,
                                    "labels": labels,
                                    "k": int(k),
                                    "params": {
                                        "n_init": int(n_init),
                                        "max_iter": int(max_iter),
                                        "init": str(init),
                                    },
                                }
        except Exception:
            best_by_k = {}

        if best_by_k:
            ranked_ks = sorted(best_by_k.keys())
            inertias = np.array([float(best_by_k[k]["inertia"]) for k in ranked_ks], dtype=float)
            silhouettes = np.array([float(best_by_k[k]["score"]) for k in ranked_ks], dtype=float)

            silhouette_k = int(ranked_ks[int(np.argmax(silhouettes))])

            elbow_k = int(ranked_ks[0])
            if len(ranked_ks) >= 3 and np.all(np.isfinite(inertias)):
                x = np.array(ranked_ks, dtype=float)
                y = inertias
                x1, y1 = float(x[0]), float(y[0])
                x2, y2 = float(x[-1]), float(y[-1])
                denom = float(np.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2))
                if denom > 0:
                    distances = np.abs((y2 - y1) * x - (x2 - x1) * y + (x2 * y1) - (y2 * x1)) / denom
                    elbow_k = int(ranked_ks[int(np.argmax(distances))])

            silhouette_min = float(np.min(silhouettes))
            silhouette_max = float(np.max(silhouettes))
            if silhouette_max - silhouette_min > 1e-12:
                silhouette_norm = {
                    int(k): float((best_by_k[int(k)]["score"] - silhouette_min) / (silhouette_max - silhouette_min))
                    for k in ranked_ks
                }
            else:
                silhouette_norm = {int(k): 1.0 for k in ranked_ks}

            k_min = int(min(ranked_ks))
            k_max = int(max(ranked_ks))
            if k_max > k_min:
                elbow_proximity = {
                    int(k): float(1.0 - (abs(int(k) - elbow_k) / float(k_max - k_min)))
                    for k in ranked_ks
                }
            else:
                elbow_proximity = {int(k): 1.0 for k in ranked_ks}

            combined_scores = {
                int(k): float((0.65 * silhouette_norm[int(k)]) + (0.35 * elbow_proximity[int(k)]))
                for k in ranked_ks
            }

            selected_k = max(
                ranked_ks,
                key=lambda k: (
                    combined_scores[int(k)],
                    1 if int(k) == elbow_k else 0,
                    best_by_k[int(k)]["score"],
                    -best_by_k[int(k)]["inertia"],
                ),
            )

            selected = best_by_k[int(selected_k)]

            return selected["labels"], {
                "k": int(selected["k"]),
                "strategy": "grid_search_elbow_silhouette",
                "silhouette": float(round(selected["score"], 6)),
                "inertia": float(round(selected["inertia"], 6)),
                "silhouette_k": int(silhouette_k),
                "elbow_k": int(elbow_k),
                "combined_score": float(round(combined_scores[int(selected_k)], 6)),
                "params": selected["params"],
            }

        fallback_k = cls._select_optimal_k(points, min_k=min_k, max_k=max_k)
        labels = cls._cluster_labels(points, fallback_k)
        return labels, {
            "k": int(fallback_k),
            "strategy": "silhouette_k_fallback",
            "silhouette": None,
            "inertia": None,
            "params": {"n_init": 25, "max_iter": 500, "init": "k-means++"},
        }

    @classmethod
    def _select_optimal_k(cls, points: np.ndarray, min_k: int = 2, max_k: int = 6):
        sample_count = points.shape[0]
        if sample_count <= 2:
            return 1

        upper_k = min(max_k, sample_count - 1)
        lower_k = min_k
        if upper_k < lower_k:
            return max(1, min(sample_count, lower_k))

        candidate_ks = list(range(lower_k, upper_k + 1))
        best_k = candidate_ks[0]
        best_score = -1.0

        try:
            import importlib

            sklearn_metrics = importlib.import_module("sklearn.metrics")
            for k in candidate_ks:
                labels = cls._cluster_labels(points, k)
                unique_labels = sorted({int(x) for x in labels.tolist()})
                if len(unique_labels) < 2:
                    continue

                score = float(sklearn_metrics.silhouette_score(points, labels, metric="euclidean"))
                if np.isfinite(score) and score > best_score:
                    best_score = score
                    best_k = k

            if best_score >= -0.99:
                return int(best_k)
        except Exception:
            pass

        heuristic = int(np.sqrt(sample_count))
        return int(max(lower_k, min(upper_k, heuristic)))

    @staticmethod
    def _normalize_embedding_for_display(embedding: np.ndarray) -> np.ndarray:
        if embedding.size == 0:
            return np.empty((0, 2), dtype=float)

        points = np.asarray(embedding, dtype=float)
        if points.shape[1] < 2:
            points = np.column_stack([points[:, 0], np.zeros(points.shape[0])])

        means = np.mean(points, axis=0)
        stds = np.std(points, axis=0)
        stds[stds == 0.0] = 1.0

        normalized = (points - means) / stds
        return normalized[:, :2]

    @staticmethod
    def _cluster_business_names(feature_frame: pd.DataFrame, labels: np.ndarray):
        if labels.size == 0:
            return {}

        profile_rows = []
        unique_labels = sorted({int(x) for x in labels.tolist()})

        for cluster_id in unique_labels:
            cluster_members = feature_frame[labels == cluster_id]
            if cluster_members.empty:
                continue

            def safe_mean(series: pd.Series) -> float:
                value = float(pd.to_numeric(series, errors="coerce").mean())
                return value if np.isfinite(value) else 0.0

            mean_vol = safe_mean(cluster_members.get("annualized_volatility"))
            mean_downside = safe_mean(cluster_members.get("downside_volatility"))
            mean_drawdown = safe_mean(cluster_members.get("max_drawdown"))
            mean_return_6m = safe_mean(cluster_members.get("return_6m"))
            mean_momentum_30d = safe_mean(cluster_members.get("momentum_30d"))
            mean_pe = safe_mean(cluster_members.get("pe_ratio"))

            risk_score = (mean_vol * 0.5) + (mean_downside * 0.2) + (mean_drawdown * 0.3)
            performance_score = (mean_return_6m * 0.65) + (mean_momentum_30d * 0.35)
            valuation_score = -mean_pe

            profile_rows.append(
                {
                    "cluster_id": cluster_id,
                    "risk_score": float(risk_score),
                    "performance_score": float(performance_score),
                    "valuation_score": float(valuation_score),
                }
            )

        if not profile_rows:
            return {}

        profile_df = pd.DataFrame(profile_rows)
        risk_high = float(profile_df["risk_score"].quantile(0.67))
        risk_low = float(profile_df["risk_score"].quantile(0.33))
        perf_high = float(profile_df["performance_score"].quantile(0.67))
        perf_low = float(profile_df["performance_score"].quantile(0.33))
        value_high = float(profile_df["valuation_score"].quantile(0.67))

        raw_names = {}
        for _, row in profile_df.iterrows():
            cluster_id = int(row["cluster_id"])
            risk = float(row["risk_score"])
            perf = float(row["performance_score"])
            value = float(row["valuation_score"])

            if perf >= perf_high and risk <= risk_low:
                name = "Growth Leaders"
            elif risk >= risk_high and perf <= perf_low:
                name = "High Risk Swing"
            elif risk <= risk_low and perf >= perf_low:
                name = "Stable Compounders"
            elif perf <= perf_low:
                name = "Turnaround Watch"
            elif value >= value_high and perf >= perf_low:
                name = "Value Opportunities"
            else:
                name = "Balanced Core"

            raw_names[cluster_id] = name

        used_counts = {}
        final_names = {}
        for cluster_id in sorted(raw_names.keys()):
            base_name = raw_names[cluster_id]
            count = used_counts.get(base_name, 0) + 1
            used_counts[base_name] = count
            final_names[cluster_id] = base_name if count == 1 else f"{base_name} {count}"

        return final_names

    def get(self, request):
        portfolio_id = request.query_params.get("portfolio_id")

        if not portfolio_id:
            return Response({"error": "portfolio_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            portfolio_id_int = int(portfolio_id)
        except Exception:
            return Response({"error": "portfolio_id must be a valid integer."}, status=status.HTTP_400_BAD_REQUEST)

        stocks = Stock.objects.select_related("portfolio").filter(portfolio_id=portfolio_id_int, portfolio__owner=request.user).order_by("id")
        if not stocks.exists():
            return Response(
                {
                    "portfolio_id": portfolio_id_int,
                    "points": [],
                    "cluster_count": 0,
                    "selected_columns": [],
                },
                status=status.HTTP_200_OK,
            )

        rows = [self._fetch_feature_row(stock) for stock in stocks]
        frame = pd.DataFrame(rows)

        candidate_columns = [
            "annualized_volatility",
            "downside_volatility",
            "max_drawdown",
            "return_6m",
            "momentum_30d",
            "pe_ratio",
            "range_ratio",
            "price_to_avg_month",
        ]
        selected_columns = self._select_important_columns(frame, candidate_columns, max_cols=6)
        if len(selected_columns) < 2:
            return Response(
                {
                    "error": "Not enough numeric data to cluster stocks in this portfolio.",
                    "selected_columns": selected_columns,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        normalized, normalization_stats, selected_frame = self._normalize_features(frame, selected_columns)
        pca_for_cluster = self._compute_pca_components(normalized, components_count=3)
        pca_embedding = self._compute_pca_2d(normalized)
        display_embedding = self._normalize_embedding_for_display(pca_embedding)

        labels, kmeans_meta = self._tune_kmeans(pca_for_cluster, min_k=2, max_k=6)
        cluster_names = self._cluster_business_names(frame, labels)

        points = []
        for idx, record in frame.iterrows():
            cluster_id = int(labels[idx]) if labels.size else 0
            features_snapshot = {
                col: self._safe_float(selected_frame.iloc[idx][col])
                for col in selected_columns
            }
            points.append(
                {
                    "stock_id": int(record["stock_id"]),
                    "name": str(record["name"]),
                    "ticker_id": str(record["ticker_id"]),
                    "cluster_id": cluster_id,
                    "cluster_label": cluster_names.get(cluster_id, f"Cluster {cluster_id + 1}"),
                    "x": self._safe_float(display_embedding[idx, 0]),
                    "y": self._safe_float(display_embedding[idx, 1]),
                    "selected_features": features_snapshot,
                }
            )

        portfolio_title = stocks.first().portfolio.title if stocks.first() is not None else ""

        return Response(
            {
                "portfolio_id": portfolio_id_int,
                "portfolio_title": portfolio_title,
                "selected_columns": selected_columns,
                "cluster_count": int(len(set(labels.tolist()))) if labels.size else 0,
                "optimal_k": int(kmeans_meta["k"]),
                "kmeans": kmeans_meta,
                "normalization": normalization_stats,
                "projection": {
                    "pca_dimensions": 2,
                    "umap_dimensions": 0,
                    "umap_engine": "disabled",
                },
                "clusters": [
                    {
                        "cluster_id": int(cluster_id),
                        "cluster_label": str(cluster_names.get(cluster_id, f"Cluster {int(cluster_id) + 1}")),
                    }
                    for cluster_id in sorted({int(x) for x in labels.tolist()})
                ] if labels.size else [],
                "points": points,
            },
            status=status.HTTP_200_OK,
        )


class DashboardAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _clean_json_value(value):
        if isinstance(value, dict):
            return {k: DashboardAPIView._clean_json_value(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [DashboardAPIView._clean_json_value(v) for v in value]
        if isinstance(value, (np.floating, np.integer)):
            value = value.item()
        if isinstance(value, float):
            if not np.isfinite(value):
                return None
            return value
        return value

    def get(self, request, ticker: str):
        symbol = str(ticker).upper().strip()
        try:
            csv_path = fetch_mod.fetch_data(symbol)
        except Exception as e:
            return Response({"error": f"Failed to fetch data: {e}"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            df = pd.read_csv(csv_path)
        except Exception as e:
            return Response({"error": f"Failed to load dataset: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        pe = self._clean_json_value(float(calc_mod.calculate_pe_ratio(df)))
        opp_df = calc_mod.calculate_opportunity_graph(df.copy())
        dis_df = calc_mod.calculate_discount_graph(df.copy())

        ma20_last = pd.to_numeric(opp_df["MA20"], errors="coerce").iloc[-1]
        ma50_last = pd.to_numeric(opp_df["MA50"], errors="coerce").iloc[-1]
        close_last = pd.to_numeric(df["Close"], errors="coerce").iloc[-1]
        mean30_last = pd.to_numeric(dis_df["Mean30"], errors="coerce").iloc[-1]
        std30_last = pd.to_numeric(dis_df["Std30"], errors="coerce").iloc[-1]

        opportunity_score = None
        if pd.notna(ma20_last) and pd.notna(ma50_last) and float(ma50_last) != 0.0:
            rel = (float(ma20_last) - float(ma50_last)) / abs(float(ma50_last))
            opportunity_score = round(max(0.0, min(100.0, 50.0 + rel * 500.0)), 2)

        discount_score = None
        if pd.notna(close_last) and pd.notna(mean30_last) and pd.notna(std30_last) and float(std30_last) > 0.0:
            z = (float(mean30_last) - float(close_last)) / float(std30_last)
            discount_score = round(max(0.0, min(100.0, 50.0 + z * 15.0)), 2)
        try:
            pe_fig = fig_mod.generate_pe_fig(df.copy())
            opp_fig = fig_mod.generate_opportunity_fig(opp_df)
            dis_fig = fig_mod.generate_discount_fig(dis_df)
            pe_path = figs_mod.save_figs(pe_fig, symbol, "pe")
            opp_path = figs_mod.save_figs(opp_fig, symbol, "opportunity")
            dis_path = figs_mod.save_figs(dis_fig, symbol, "discount")
        except Exception as e:
            pe_path = opp_path = dis_path = ""
        def to_url(p: str):
            rel = os.path.relpath(p, settings.MEDIA_ROOT)
            return request.build_absolute_uri(settings.MEDIA_URL + rel.replace("\\", "/"))
        top10 = df.head(10).to_dict(orient="records")
        def line(df_src, col):
            out = []
            for d, v in zip(df_src["Date"], df_src[col]):
                if pd.isna(v):
                    continue
                out.append({"time": str(d), "value": float(v)})
            return out
        def markers_from(df_src, buy_col, sell_col, buy_color="#22C55E", sell_color="#EF4444"):
            out = []
            for d, buy, sell in zip(df_src["Date"], df_src[buy_col], df_src[sell_col]):
                buy_val = pd.to_numeric(buy, errors="coerce")
                sell_val = pd.to_numeric(sell, errors="coerce")
                if pd.notna(buy_val) and int(buy_val) == 1:
                    out.append({"time": str(d), "position": "belowBar", "color": buy_color, "shape": "arrowUp", "text": "Buy"})
                elif pd.notna(sell_val) and int(sell_val) == 1:
                    out.append({"time": str(d), "position": "aboveBar", "color": sell_color, "shape": "arrowDown", "text": "Sell"})
            return out
        payload = {
            "ticker": symbol,
            "data_head": top10,
            "pe_ratio": pe,
            "opportunity_score": opportunity_score,
            "discount_score": discount_score,
            "fig_urls": {
                "pe": pe_path and to_url(pe_path),
                "opportunity": opp_path and to_url(opp_path),
                "discount": dis_path and to_url(dis_path),
            },
            "series": {
                "price": line(df, "Close"),
                "ma60": line(df.assign(MA60=df["Close"].rolling(window=60, min_periods=10).mean().bfill()), "MA60"),
                "ma20": line(opp_df, "MA20"),
                "ma50": line(opp_df, "MA50"),
                "mean30": line(dis_df, "Mean30"),
                "buy_sell_markers": markers_from(opp_df, "buy_signal", "sell_signal"),
                "undervalued_markers": [{"time": str(d), "position": "belowBar", "color": "#F59E0B", "shape": "circle", "text": "Undervalued"} for d, u in zip(dis_df["Date"], dis_df["Undervalued"]) if u == 1],
            },
        }
        return Response(self._clean_json_value(payload), status=status.HTTP_200_OK)


class StockForecastAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        ticker_symbol = request.query_params.get('ticker')
        horizon = request.query_params.get('horizon', '7')

        if not ticker_symbol:
            return Response({'error': 'Ticker is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            days = int(horizon)
        except ValueError:
            days = 7
        days = max(1, days)

        ticker_key = str(ticker_symbol).upper().strip()
        intraday_assets = {"BTC-USD", "GC=F", "SI=F"}
        is_intraday = ticker_key in intraday_assets

        if is_intraday:
            requested_period = '120d'
            requested_interval = '1h'
            step_unit = 'hour'
            days = min(days, 24)
        else:
            requested_period = '3y'
            requested_interval = '1d'
            step_unit = 'day'
            days = min(days, 90)

        cache_key = f"forecast:v2:{ticker_key}:{days}:{requested_period}:{requested_interval}:{step_unit}"
        cached_payload = cache.get(cache_key)
        if cached_payload is not None:
            return Response(cached_payload, status=status.HTTP_200_OK)

        try:
            used_interval = requested_interval
            history, resolved_symbol, _ = fetch_mod.fetch_history_with_meta(
                ticker_symbol,
                period=requested_period,
                interval=requested_interval,
                auto_adjust=False,
            )
            ticker_obj = yf.Ticker(resolved_symbol)
            info = ticker_obj.info or {}
            title = info.get("shortName") or info.get("longName") or ticker_symbol

            df = history

            if df.empty:
                return Response({'error': f'No data found for ticker: {ticker_symbol}'}, status=status.HTTP_404_NOT_FOUND)

            df.index = pd.to_datetime(df.index)
            df.sort_index(inplace=True)

            forecast_data = fore_mod.get_forecasts(df, days, step_unit=step_unit)
            actual_price = float(df['Close'].iloc[-1]) if not df.empty else None

            payload = {
                'title': title,
                'ticker': ticker_symbol,
                'actual_price': actual_price,
                'dataset': {
                    'requested_period': requested_period,
                    'requested_interval': requested_interval,
                    'used_interval': used_interval,
                    'rows': int(len(df)),
                    'from': str(df.index.min()),
                    'to': str(df.index.max()),
                },
                'data': forecast_data
            }
            cache.set(cache_key, payload, timeout=300 if is_intraday else 900)
            return Response(payload, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
