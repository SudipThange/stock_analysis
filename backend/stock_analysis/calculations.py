import pandas as pd
import numpy as np

def calculate_pe_ratio(df: pd.DataFrame) -> float:
    close = df["Close"].astype(float)
    ma = close.rolling(window=60, min_periods=10).mean()
    val = float(close.iloc[-1] / ma.iloc[-1]) if np.isfinite(ma.iloc[-1]) else float("nan")
    return val

def calculate_opportunity_graph(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["Close"] = df["Close"].astype(float)
    df["MA20"] = df["Close"].rolling(window=20, min_periods=5).mean()
    df["MA50"] = df["Close"].rolling(window=50, min_periods=10).mean()
    df["Signal"] = (df["MA20"] > df["MA50"]).astype(int)
    df["Position"] = df["Signal"].diff().fillna(0)
    return df

def calculate_discount_graph(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["Close"] = df["Close"].astype(float)
    df["Mean30"] = df["Close"].rolling(window=30, min_periods=10).mean()
    df["Std30"] = df["Close"].rolling(window=30, min_periods=10).std()
    df["Undervalued"] = (df["Close"] < (df["Mean30"] - 1.0 * df["Std30"])).astype(int)
    return df
