import warnings

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import MinMaxScaler
from statsmodels.tsa.arima.model import ARIMA
from tensorflow.keras.callbacks import EarlyStopping
from tensorflow.keras.layers import Dense, Input, LSTM
from tensorflow.keras.models import Sequential

warnings.filterwarnings("ignore")


MAX_POINTS_LR = 2400
MAX_POINTS_ARIMA = 600
MAX_POINTS_RNN = 360


def _clean_close_series(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["Close"] = pd.to_numeric(out["Close"], errors="coerce")
    out = out.dropna(subset=["Close"]).copy()
    out = out[~out.index.duplicated(keep="last")]
    out = out.sort_index()
    return out


def _safe_float(value):
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def _compute_eda(frame: pd.DataFrame):
    close = pd.to_numeric(frame["Close"], errors="coerce")
    total_rows = int(len(frame))
    missing_close = int(close.isna().sum())
    clean_close = close.dropna()

    return {
        "rows": total_rows,
        "start": str(frame.index.min()) if total_rows else None,
        "end": str(frame.index.max()) if total_rows else None,
        "missing_close": missing_close,
        "close_mean": _safe_float(clean_close.mean()) if not clean_close.empty else None,
        "close_std": _safe_float(clean_close.std(ddof=0)) if not clean_close.empty else None,
        "close_min": _safe_float(clean_close.min()) if not clean_close.empty else None,
        "close_max": _safe_float(clean_close.max()) if not clean_close.empty else None,
    }


def _build_feature_frame(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    out["Close"] = pd.to_numeric(out["Close"], errors="coerce")
    out["lag1"] = out["Close"].shift(1)
    out["lag2"] = out["Close"].shift(2)
    out["lag3"] = out["Close"].shift(3)
    out["ma6"] = out["Close"].rolling(window=6, min_periods=1).mean()
    out["ma24"] = out["Close"].rolling(window=24, min_periods=1).mean()
    out["std24"] = out["Close"].rolling(window=24, min_periods=2).std(ddof=0)
    out["ret1"] = out["Close"].pct_change().replace([np.inf, -np.inf], np.nan)
    out["idx"] = np.arange(len(out), dtype=float)

    out = out.dropna(subset=["Close", "lag1", "lag2", "lag3", "ma6", "ma24", "std24", "ret1"]).copy()
    return out


def _future_lr_features(rolling_close, future_idx: float):
    lag1 = float(rolling_close[-1])
    lag2 = float(rolling_close[-2])
    lag3 = float(rolling_close[-3])
    ma6 = float(np.mean(rolling_close[-6:]))
    ma24 = float(np.mean(rolling_close[-24:])) if len(rolling_close) >= 24 else float(np.mean(rolling_close))
    std24 = float(np.std(rolling_close[-24:], ddof=0)) if len(rolling_close) >= 24 else float(np.std(rolling_close, ddof=0))
    ret1 = (lag1 / lag2 - 1.0) if lag2 != 0 else 0.0
    return np.array([lag1, lag2, lag3, ma6, ma24, std24, ret1, future_idx], dtype=float)


def forecast_linear_regression(df: pd.DataFrame, days: int, return_history: bool = False):
    frame = _clean_close_series(df).tail(MAX_POINTS_LR).copy()
    feat = _build_feature_frame(frame)

    if len(feat) < 10:
        last_val = float(frame["Close"].iloc[-1])
        fallback = np.full(days, last_val)
        if return_history:
            return fallback, pd.Series(dtype=float)
        return fallback

    X = feat[["lag1", "lag2", "lag3", "ma6", "ma24", "std24", "ret1", "idx"]].values
    y = feat["Close"].values

    model = LinearRegression()
    model.fit(X, y)
    hist_series = pd.Series(model.predict(X).astype(float), index=feat.index)

    preds = []
    last_idx = float(feat["idx"].iloc[-1])
    rolling = frame["Close"].tolist()
    if len(rolling) < 4:
        fallback = np.full(days, float(rolling[-1]))
        if return_history:
            return fallback, hist_series
        return fallback

    for step in range(1, days + 1):
        future_idx = last_idx + step
        future_features = _future_lr_features(rolling, future_idx)
        pred = float(model.predict(future_features.reshape(1, -1))[0])
        preds.append(pred)
        rolling.append(pred)

    if return_history:
        return np.array(preds, dtype=float), hist_series
    return np.array(preds, dtype=float)


def _fit_best_arima(series: np.ndarray):
    candidates = [(1, 1, 1), (2, 1, 1), (2, 1, 2)]
    best_fit = None
    best_aic = float("inf")

    for order in candidates:
        try:
            fit = ARIMA(
                series,
                order=order,
                enforce_stationarity=False,
                enforce_invertibility=False,
            ).fit(method_kwargs={"maxiter": 50, "disp": 0})
            if np.isfinite(fit.aic) and float(fit.aic) < best_aic:
                best_aic = float(fit.aic)
                best_fit = fit
        except Exception:
            continue

    if best_fit is not None:
        return best_fit

    try:
        return ARIMA(
            series,
            order=(1, 1, 1),
            enforce_stationarity=False,
            enforce_invertibility=False,
        ).fit(method_kwargs={"maxiter": 40, "disp": 0})
    except Exception:
        return None


def forecast_arima(df: pd.DataFrame, days: int, return_history: bool = False):
    frame = _clean_close_series(df).tail(MAX_POINTS_ARIMA).copy()
    series = frame["Close"].values

    if series.shape[0] < 30:
        fallback = np.full(days, float(series[-1]))
        if return_history:
            return fallback, pd.Series(dtype=float)
        return fallback

    model_fit = _fit_best_arima(series)
    if model_fit is None:
        fallback = np.full(days, float(series[-1]))
        if return_history:
            return fallback, pd.Series(dtype=float)
        return fallback

    future = np.array(model_fit.forecast(steps=days), dtype=float)
    if not return_history:
        return future

    try:
        hist = np.asarray(model_fit.fittedvalues, dtype=float).reshape(-1)
        hist = hist[np.isfinite(hist)]
        hist_index = frame.index[-len(hist):] if len(hist) else frame.index[:0]
        hist_series = pd.Series(hist.astype(float), index=hist_index)
    except Exception:
        hist_series = pd.Series(dtype=float)

    return future, hist_series


def forecast_rnn(df: pd.DataFrame, days: int, return_history: bool = False):
    np.random.seed(42)
    frame = _clean_close_series(df).tail(MAX_POINTS_RNN).copy()
    series = frame["Close"].values.reshape(-1, 1)

    if len(series) < 80:
        fallback = np.full(days, float(series[-1].flatten()[0]))
        if return_history:
            return fallback, pd.Series(dtype=float)
        return fallback

    scaler = MinMaxScaler()
    scaled_data = scaler.fit_transform(series)

    window = 16
    if len(scaled_data) <= window + 5:
        fallback = np.full(days, float(series[-1].flatten()[0]))
        if return_history:
            return fallback, pd.Series(dtype=float)
        return fallback

    X_train = []
    y_train = []
    for i in range(window, len(scaled_data)):
        X_train.append(scaled_data[i - window:i, 0])
        y_train.append(scaled_data[i, 0])

    X_train = np.array(X_train)
    y_train = np.array(y_train)
    X_train = np.reshape(X_train, (X_train.shape[0], X_train.shape[1], 1))

    split = max(int(len(X_train) * 0.9), 1)
    X_fit, y_fit = X_train[:split], y_train[:split]
    X_val, y_val = X_train[split:], y_train[split:]

    model = Sequential([
        Input(shape=(window, 1)),
        LSTM(units=16),
        Dense(1),
    ])
    model.compile(optimizer="adam", loss="mean_squared_error")

    monitor = "val_loss" if len(X_val) else "loss"
    callbacks = [EarlyStopping(monitor=monitor, patience=1, restore_best_weights=True)]
    model.fit(
        X_fit,
        y_fit,
        epochs=2,
        batch_size=64,
        validation_data=(X_val, y_val) if len(X_val) else None,
        callbacks=callbacks,
        verbose=0,
    )

    hist_count = min(12, len(X_train))
    hist_pred_scaled = model.predict(X_train[-hist_count:], verbose=0).reshape(-1, 1)
    hist_pred = scaler.inverse_transform(hist_pred_scaled).flatten()
    hist_index = frame.index[window:][-hist_count:]
    hist_series = pd.Series(hist_pred.astype(float), index=hist_index)

    inputs = scaled_data[-window:]
    current_batch = inputs.reshape((1, window, 1))
    preds = []

    for _ in range(days):
        current_pred = model.predict(current_batch, verbose=0)[0]
        preds.append(current_pred)
        current_batch = np.append(current_batch[:, 1:, :], [[current_pred]], axis=1)

    res = scaler.inverse_transform(np.array(preds).reshape(-1, 1))
    future = res.flatten().astype(float)
    if return_history:
        return future, hist_series
    return future


def _build_historical_table(
    frame: pd.DataFrame,
    lr_hist: pd.Series,
    arima_hist: pd.Series,
    rnn_hist: pd.Series,
    date_fmt: str,
    points: int = 10,
):
    if frame.empty:
        return []

    recent_idx = frame.index[-points:]

    def build_err(pred_val, actual_val: float):
        if pred_val is None or pd.isna(pred_val):
            return None, None
        pred = float(pred_val)
        diff = pred - actual_val
        err = float((abs(diff) / actual_val) * 100.0) if actual_val else None
        return diff, err

    out = []
    for ts in recent_idx[::-1]:
        actual = float(frame.loc[ts, "Close"])
        lr_val = lr_hist.get(ts, np.nan)
        arima_val = arima_hist.get(ts, np.nan)
        rnn_val = rnn_hist.get(ts, np.nan)

        lr_diff, lr_err = build_err(lr_val, actual)
        arima_diff, arima_err = build_err(arima_val, actual)
        rnn_diff, rnn_err = build_err(rnn_val, actual)

        out.append({
            "date": pd.Timestamp(ts).strftime(date_fmt),
            "actual": actual,
            "lr": None if pd.isna(lr_val) else float(lr_val),
            "lr_diff": lr_diff,
            "lr_error": lr_err,
            "arima": None if pd.isna(arima_val) else float(arima_val),
            "arima_diff": arima_diff,
            "arima_error": arima_err,
            "rnn": None if pd.isna(rnn_val) else float(rnn_val),
            "rnn_diff": rnn_diff,
            "rnn_error": rnn_err,
            "is_predicted": False,
        })

    return out


def get_forecasts(df: pd.DataFrame, days: int, step_unit: str = "day"):
    days = max(1, int(days))
    frame = _clean_close_series(df)
    if frame.empty:
        return {
            "table": [],
            "historical_table": [],
            "next_prediction": None,
            "eda": _compute_eda(frame),
            "normalization": "minmax_for_rnn",
            "feature_columns": [],
            "charts": {"history": [], "lr": [], "arima": [], "rnn": []},
        }

    eda = _compute_eda(frame)

    lr_future, lr_hist = forecast_linear_regression(frame, days, return_history=True)
    arima_future, arima_hist = forecast_arima(frame, days, return_history=True)
    rnn_future, rnn_hist = forecast_rnn(frame, days, return_history=True)

    actual_price = float(frame["Close"].iloc[-1])
    last_date = frame.index[-1]
    step = str(step_unit or "day").lower()
    if step in {"hour", "1h", "h"}:
        delta = pd.Timedelta(hours=1)
        date_fmt = "%Y-%m-%d %H:%M"
    else:
        delta = pd.Timedelta(days=1)
        date_fmt = "%Y-%m-%d"

    future_dates = pd.date_range(start=last_date + delta, periods=days, freq=delta)

    def build_err(pred_val: float):
        diff = float(pred_val - actual_price)
        err = float((abs(diff) / actual_price) * 100.0) if actual_price else None
        return diff, err

    results = []
    for i in range(days):
        lr_diff, lr_err = build_err(float(lr_future[i]))
        arima_diff, arima_err = build_err(float(arima_future[i]))
        rnn_diff, rnn_err = build_err(float(rnn_future[i]))
        results.append({
            "date": future_dates[i].strftime(date_fmt),
            "actual": actual_price,
            "lr": float(lr_future[i]),
            "lr_diff": lr_diff,
            "lr_error": lr_err,
            "arima": float(arima_future[i]),
            "arima_diff": arima_diff,
            "arima_error": arima_err,
            "rnn": float(rnn_future[i]),
            "rnn_diff": rnn_diff,
            "rnn_error": rnn_err,
            "is_predicted": True,
        })

    history_series = [
        {"time": pd.Timestamp(d).strftime(date_fmt), "value": float(v)}
        for d, v in zip(frame.index[-120:], frame["Close"][-120:])
    ]

    historical_table = _build_historical_table(
        frame=frame,
        lr_hist=lr_hist,
        arima_hist=arima_hist,
        rnn_hist=rnn_hist,
        date_fmt=date_fmt,
        points=10,
    )

    next_prediction = results[0] if results else None
    return {
        "table": results,
        "historical_table": historical_table,
        "next_prediction": next_prediction,
        "eda": eda,
        "normalization": "minmax_for_rnn",
        "feature_columns": [
            "Open",
            "High",
            "Low",
            "Close",
            "Volume",
            "lag1",
            "lag2",
            "lag3",
            "ma6",
            "ma24",
            "std24",
            "ret1",
            "idx",
        ],
        "charts": {
            "history": history_series,
            "lr": [{"time": r["date"], "value": r["lr"]} for r in results],
            "arima": [{"time": r["date"], "value": r["arima"]} for r in results],
            "rnn": [{"time": r["date"], "value": r["rnn"]} for r in results],
        },
    }
