from __future__ import annotations

import csv
import threading
from pathlib import Path
from typing import List, Dict

from django.conf import settings

_SYMBOLS: List[Dict[str, str]] = []
_LOADED = False
_LOCK = threading.Lock()


def _candidate_paths() -> List[Path]:
    configured = getattr(settings, "STOCKS_MASTER_CSV", None)
    if configured:
        return [Path(configured)]

    base_dir = Path(settings.BASE_DIR)
    return [
        base_dir / "stocks_master.csv",
        base_dir.parent / "stocks_master.csv",
        base_dir.parent.parent / "stocks_master.csv",
    ]


def _normalize_row(row: Dict[str, str]) -> Dict[str, str] | None:
    symbol = (row.get("symbol") or "").strip().upper()
    company_name = (row.get("company_name") or row.get("name") or "").strip()
    exchange = (row.get("exchange") or "").strip().upper()

    if not symbol or not company_name:
        return None

    return {
        "symbol": symbol,
        "company_name": company_name,
        "exchange": exchange,
        "_symbol_lc": symbol.lower(),
        "_name_lc": company_name.lower(),
    }


def load_symbols(force: bool = False) -> int:
    global _LOADED, _SYMBOLS

    with _LOCK:
        if _LOADED and not force:
            return len(_SYMBOLS)

        loaded_symbols: List[Dict[str, str]] = []
        csv_path = next((p for p in _candidate_paths() if p.exists()), None)

        if csv_path is not None:
            with csv_path.open("r", encoding="utf-8", newline="") as handle:
                reader = csv.DictReader(handle)
                for row in reader:
                    normalized = _normalize_row(row)
                    if normalized is not None:
                        loaded_symbols.append(normalized)

        _SYMBOLS = loaded_symbols
        _LOADED = True
        return len(_SYMBOLS)


def search_symbols(query: str, limit: int = 10) -> List[Dict[str, str]]:
    q = (query or "").strip().lower()
    if not q:
        return []

    if not _LOADED:
        load_symbols()

    symbol_prefix = []
    name_prefix = []

    for row in _SYMBOLS:
        if row["_symbol_lc"].startswith(q):
            symbol_prefix.append(row)
        elif row["_name_lc"].startswith(q):
            name_prefix.append(row)

    ranked = symbol_prefix + name_prefix
    seen = set()
    output: List[Dict[str, str]] = []

    for row in ranked:
        symbol = row["symbol"]
        if symbol in seen:
            continue
        seen.add(symbol)
        output.append(
            {
                "symbol": row["symbol"],
                "company_name": row["company_name"],
                "exchange": row["exchange"],
            }
        )
        if len(output) >= limit:
            break

    return output


def get_loaded_count() -> int:
    if not _LOADED:
        return load_symbols()
    return len(_SYMBOLS)
