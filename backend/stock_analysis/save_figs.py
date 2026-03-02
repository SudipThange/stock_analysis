import os
from django.conf import settings

def save_figs(fig, ticker: str, fig_type: str) -> str:
    symbol = str(ticker).upper().strip()
    out_dir = os.path.join(settings.MEDIA_ROOT, "stock_figures", symbol)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{fig_type}.png")
    fig.savefig(out_path, bbox_inches="tight")
    return os.path.abspath(out_path)
