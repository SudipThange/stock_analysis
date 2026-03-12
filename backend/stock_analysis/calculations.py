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

    # Core indicators
    df["MA20"] = df["Close"].rolling(window=20, min_periods=20).mean()
    df["MA50"] = df["Close"].rolling(window=50, min_periods=50).mean()

    # RSI(14) using Wilder-style exponential smoothing.
    delta = df["Close"].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / 14, adjust=False, min_periods=14).mean()
    avg_loss = loss.ewm(alpha=1 / 14, adjust=False, min_periods=14).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    # If average loss is exactly zero and there are gains, RSI is effectively 100.
    rsi = rsi.where(~((avg_loss == 0) & (avg_gain > 0)), 100.0)
    df["RSI14"] = rsi

    # Volatility filter from rolling daily return std.
    returns = df["Close"].pct_change()
    rolling_vol = returns.rolling(window=20, min_periods=20).std()
    vol_threshold = rolling_vol.quantile(0.25)
    if not np.isfinite(vol_threshold):
        vol_threshold = 0.0
    vol_ok = rolling_vol > float(vol_threshold)

    ma20 = df["MA20"]
    ma50 = df["MA50"]
    prev_ma20 = ma20.shift(1)
    prev_ma50 = ma50.shift(1)

    # True crossover events only (golden/death cross at crossover bar).
    cross_up = (ma20 > ma50) & (prev_ma20 <= prev_ma50)
    cross_down = (ma20 < ma50) & (prev_ma20 >= prev_ma50)

    # Quality filters
    ma20_slope = ma20.diff()
    slope_buy_ok = ma20_slope > 0
    slope_sell_ok = ma20_slope < 0
    momentum_buy_ok = df["Close"] > ma50
    momentum_sell_ok = df["Close"] < ma50
    rsi_buy_ok = df["RSI14"] > 50
    rsi_sell_ok = df["RSI14"] < 50

    raw_buy = cross_up & (df["Close"] > ma20) & momentum_buy_ok & rsi_buy_ok & slope_buy_ok & vol_ok
    raw_sell = cross_down & (df["Close"] < ma20) & momentum_sell_ok & rsi_sell_ok & slope_sell_ok & vol_ok

    raw_signal = pd.Series(np.select([raw_buy, raw_sell], [1, -1], default=0), index=df.index, dtype="int8")

    # Cooldown: prevent emitting another signal within 10 trading sessions.
    cooldown_days = 10
    filtered = np.zeros(len(df), dtype=np.int8)
    candidate_idx = np.flatnonzero(raw_signal.to_numpy() != 0)
    last_kept = -10**9
    for i in candidate_idx:
        if i - last_kept > cooldown_days:
            filtered[i] = raw_signal.iat[i]
            last_kept = i

    # Output columns requested by downstream consumers.
    df["ma20"] = df["MA20"]
    df["ma50"] = df["MA50"]
    df["buy_signal"] = (filtered == 1).astype(int)
    df["sell_signal"] = (filtered == -1).astype(int)

    # Backward-compatible fields for existing code paths.
    df["Signal"] = (df["MA20"] > df["MA50"]).astype(int)
    df["Position"] = pd.Series(filtered, index=df.index)
    return df

def calculate_discount_graph(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["Close"] = df["Close"].astype(float)
    df["Mean30"] = df["Close"].rolling(window=30, min_periods=10).mean()
    df["Std30"] = df["Close"].rolling(window=30, min_periods=10).std()
    df["Undervalued"] = (df["Close"] < (df["Mean30"] - 1.0 * df["Std30"])).astype(int)
    return df
