from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import Stock
from .serializers import StockSerializer
from urllib.request import Request, urlopen
from urllib.parse import urlencode
import json
import re
import pandas as pd
import numpy as np
import yfinance as yf
import os
from django.conf import settings
from datetime import datetime, timedelta
from . import views as _self  # self-reference to avoid unused warnings
import fetch_data as fetch_mod
import calculations as calc_mod
import save_fig as fig_mod
import save_figs as figs_mod


# ============================================
# 🔹 LIST & CREATE STOCK
# ============================================
class StockListCreateAPIView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    # 📌 GET → Get All Stocks
    def get(self, request):
        stocks = Stock.objects.all()
        serializer = StockSerializer(stocks, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


    # 📌 POST → Create Stock
    def post(self, request):
        serializer = StockSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



# ============================================
# 🔹 RETRIEVE, UPDATE, DELETE STOCK
# ============================================
class StockDetailAPIView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, pk):
        try:
            return Stock.objects.get(pk=pk)
        except Stock.DoesNotExist:
            return None


    # 📌 GET → Get Single Stock
    def get(self, request, pk):
        stock = self.get_object(pk)

        if not stock:
            return Response(
                {"error": "Stock not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = StockSerializer(stock)
        return Response(serializer.data, status=status.HTTP_200_OK)


    # 📌 PUT → Update Entire Stock
    def put(self, request, pk):
        stock = self.get_object(pk)

        if not stock:
            return Response(
                {"error": "Stock not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = StockSerializer(stock, data=request.data)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


    # 📌 PATCH → Partial Update
    def patch(self, request, pk):
        stock = self.get_object(pk)

        if not stock:
            return Response(
                {"error": "Stock not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = StockSerializer(
            stock,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


    # 📌 DELETE → Remove Stock
    def delete(self, request, pk):
        stock = self.get_object(pk)

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

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response({"results": []}, status=status.HTTP_200_OK)
        q_lower = q.lower()
        q_norm = re.sub(r"[^a-z0-9]", "", q_lower)

        def norm(text: str) -> str:
            return re.sub(r"[^a-z0-9]", "", (text or "").lower())

        def score_item(item):
            name = str(item.get("name") or "").lower()
            symbol = str(item.get("symbol") or "").lower()
            name_norm = norm(name)
            symbol_norm = norm(symbol)
            score = 0
            if symbol.startswith(q_lower):
                score += 4
            if name.startswith(q_lower):
                score += 3
            if q_lower in symbol:
                score += 2
            if q_lower in name:
                score += 1
            if q_norm and symbol_norm.startswith(q_norm):
                score += 2
            if q_norm and name_norm.startswith(q_norm):
                score += 2
            if q_norm and q_norm in symbol_norm:
                score += 1
            if q_norm and q_norm in name_norm:
                score += 1
            return score

        def keep_matching(items):
            out = []
            for item in items:
                name = str(item.get("name") or "").lower()
                symbol = str(item.get("symbol") or "").lower()
                name_norm = norm(name)
                symbol_norm = norm(symbol)
                if q_lower in name or q_lower in symbol or (q_norm and (q_norm in name_norm or q_norm in symbol_norm)):
                    out.append(item)
            out.sort(key=score_item, reverse=True)
            return out

        def merge_lists(*lists, limit=20):
            out = []
            seen = set()
            for source in lists:
                for item in source:
                    sym = str(item.get("symbol") or "").upper().strip()
                    if not sym or sym in seen:
                        continue
                    seen.add(sym)
                    out.append(item)
                    if len(out) >= limit:
                        return out
            return out

        def fetch_quotes(query: str):
            try:
                search = yf.Search(query, max_results=25)
                quotes = getattr(search, "quotes", []) or []
                if quotes:
                    return quotes
            except Exception:
                pass

            endpoints = [
                "https://query1.finance.yahoo.com/v1/finance/search",
                "https://query2.finance.yahoo.com/v1/finance/search",
            ]
            for base in endpoints:
                try:
                    url = f"{base}?{urlencode({'q': query, 'quotesCount': 25, 'newsCount': 0})}"
                    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
                    with urlopen(req, timeout=15) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                    quotes = data.get("quotes", []) or []
                    if quotes:
                        return quotes
                except Exception:
                    continue
            return []

        def to_indian_equities(quotes):
            out = []
            seen = set()
            for it in quotes:
                if it.get("quoteType") != "EQUITY":
                    continue
                name = it.get("shortname") or it.get("longname") or it.get("symbol")
                sym = it.get("symbol") or ""
                exch = it.get("exchange") or ""
                reg = it.get("region") or ""
                if not self._is_indian_equity(sym, exch, reg):
                    continue
                if sym in seen:
                    continue
                seen.add(sym)
                out.append({
                    "name": name,
                    "symbol": sym,
                    "exchange": exch,
                    "region": reg
                })
            return out

        def to_equities(quotes):
            out = []
            seen = set()
            for it in quotes:
                if it.get("quoteType") != "EQUITY":
                    continue
                name = it.get("shortname") or it.get("longname") or it.get("symbol")
                sym = it.get("symbol") or ""
                exch = it.get("exchange") or ""
                reg = it.get("region") or ""
                if sym in seen:
                    continue
                seen.add(sym)
                out.append({
                    "name": name,
                    "symbol": sym,
                    "exchange": exch,
                    "region": reg,
                })
            return out

        raw_variants = [
            q,
            q.replace(" ", ""),
            q.replace("&", ""),
            f"{q}.NS",
            f"{q}.BO",
            f"{q} NSE",
            f"{q} BSE",
            f"{q} stock",
            f"{q} india",
        ]
        variants = []
        seen_variant = set()
        for v in raw_variants:
            key = v.strip().lower()
            if not key or key in seen_variant:
                continue
            seen_variant.add(key)
            variants.append(v.strip())

        quotes = []
        try:
            seen_symbols = set()
            for variant in variants:
                for item in fetch_quotes(variant):
                    sym = (item.get("symbol") or "").upper()
                    if not sym or sym in seen_symbols:
                        continue
                    seen_symbols.add(sym)
                    quotes.append(item)
                    if len(quotes) >= 40:
                        break
                if len(quotes) >= 40:
                    break
        except Exception:
            quotes = []

        indian_market = keep_matching(to_indian_equities(quotes))
        broader_market = keep_matching(to_equities(quotes))

        out = merge_lists(indian_market, broader_market, limit=20)

        return Response({"results": out}, status=status.HTTP_200_OK)


class ExploreGoldSilverAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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
        start_date = end_date - timedelta(days=365 * 5)

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
                "x": float(row.gold_close),
                "y": float(row.silver_close),
                "date": str(row.Date),
            }
            for row in merged.itertuples(index=False)
        ]

        silver_vs_gold = [
            {
                "x": float(row.silver_close),
                "y": float(row.gold_close),
                "date": str(row.Date),
            }
            for row in merged.itertuples(index=False)
        ]

        regression_gold_to_silver = self._fit_linear(merged, "gold_close", "silver_close")
        regression_silver_to_gold = self._fit_linear(merged, "silver_close", "gold_close")

        return Response(
            {
                "from": str(merged["Date"].iloc[0]),
                "to": str(merged["Date"].iloc[-1]),
                "growth_series": growth_series,
                "gold_vs_silver": gold_vs_silver,
                "silver_vs_gold": silver_vs_gold,
                "regression_gold_to_silver": regression_gold_to_silver,
                "regression_silver_to_gold": regression_silver_to_gold,
            },
            status=status.HTTP_200_OK,
        )


class DashboardAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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
        pe = float(calc_mod.calculate_pe_ratio(df))
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
        def markers_from(df_src, col, color):
            out = []
            for d, pos, close in zip(df_src["Date"], df_src[col], df_src["Close"]):
                if pos == 1:
                    out.append({"time": str(d), "position": "belowBar", "color": color, "shape": "arrowUp", "text": "Buy"})
                elif pos == -1:
                    out.append({"time": str(d), "position": "aboveBar", "color": "#EF4444", "shape": "arrowDown", "text": "Sell"})
            return out
        return Response({
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
                "buy_sell_markers": markers_from(opp_df, "Position", "#22C55E"),
                "undervalued_markers": [{"time": str(d), "position": "belowBar", "color": "#F59E0B", "shape": "circle", "text": "Undervalued"} for d, u in zip(dis_df["Date"], dis_df["Undervalued"]) if u == 1],
            },
        }, status=status.HTTP_200_OK)
