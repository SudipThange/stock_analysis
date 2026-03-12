import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

def generate_pe_fig(df):
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(df["Date"], df["Close"], label="Close", color="#4F46E5")
    close = df["Close"].astype(float)
    ma = close.rolling(window=60, min_periods=10).mean()
    ax.plot(df["Date"], ma, label="60-day MA", color="#10B981")
    ax.set_title("Price vs 60-day Average")
    ax.set_xlabel("Date")
    ax.set_ylabel("Price")
    ax.legend()
    fig.tight_layout()
    return fig

def generate_opportunity_fig(df):
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(df["Date"], df["Close"], label="Close", color="#4F46E5")
    ax.plot(df["Date"], df["MA20"], label="MA20", color="#F59E0B")
    ax.plot(df["Date"], df["MA50"], label="MA50", color="#10B981")
    if "buy_signal" in df.columns and "sell_signal" in df.columns:
        buys = df[df["buy_signal"] == 1]
        sells = df[df["sell_signal"] == 1]
    else:
        buys = df[df["Position"] == 1]
        sells = df[df["Position"] == -1]
    ax.scatter(buys["Date"], buys["Close"], marker="^", color="#22C55E", label="Buy", zorder=3)
    ax.scatter(sells["Date"], sells["Close"], marker="v", color="#EF4444", label="Sell", zorder=3)
    ax.set_title("Opportunity Signals (MA Crossover)")
    ax.set_xlabel("Date")
    ax.set_ylabel("Price")
    ax.legend()
    fig.tight_layout()
    return fig

def generate_discount_fig(df):
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(df["Date"], df["Close"], label="Close", color="#4F46E5")
    ax.plot(df["Date"], df["Mean30"], label="Mean30", color="#10B981")
    under = df[df["Undervalued"] == 1]
    ax.scatter(under["Date"], under["Close"], color="#EF4444", label="Undervalued", s=20, zorder=3)
    ax.set_title("Discount Zones vs Rolling Mean")
    ax.set_xlabel("Date")
    ax.set_ylabel("Price")
    ax.legend()
    fig.tight_layout()
    return fig
