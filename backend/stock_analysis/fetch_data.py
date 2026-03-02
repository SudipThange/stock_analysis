import logging
import os
import pandas as pd
from django.conf import settings
import yfinance as yf

logger = logging.getLogger(__name__)

def fetch_data(ticker: str) -> str:
    symbol = str(ticker).upper().strip()
    base_dir = os.path.join(settings.MEDIA_ROOT, "stock_data")
    os.makedirs(base_dir, exist_ok=True)
    out_path = os.path.join(base_dir, f"{symbol}.csv")
    try:
        candidates = [symbol]
        if "." not in symbol:
            candidates += [f"{symbol}.NS", f"{symbol}.BO"]
        df = pd.DataFrame()
        for s in candidates:
            df = yf.Ticker(s).history(period="1y", interval="1d", auto_adjust=False)
            if not df.empty:
                break
        if df.empty:
            raise ValueError(f"No data for symbol (tried: {', '.join(candidates)})")
        df = df.reset_index()[["Date", "Close"]]
        df["Date"] = pd.to_datetime(df["Date"]).dt.date
        df = df.dropna().sort_values("Date")
        df.to_csv(out_path, index=False)
        return os.path.abspath(out_path)
    except Exception as e:
        logger.error("Fetch error for %s: %s", symbol, e)
        raise
