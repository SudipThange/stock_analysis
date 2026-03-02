from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import Stock
from .serializers import StockSerializer
from portfolio.models import Portfolio
from urllib.request import Request, urlopen
from urllib.parse import urlencode
import json
import pandas as pd
import os
from django.conf import settings
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

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response({"results": []}, status=status.HTTP_200_OK)
        url = f"https://query2.finance.yahoo.com/v1/finance/search?{urlencode({'q': q})}"
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception:
            return Response({"results": []}, status=status.HTTP_200_OK)
        quotes = data.get("quotes", []) or []
        out = []
        for it in quotes:
            if it.get("quoteType") != "EQUITY":
                continue
            name = it.get("shortname") or it.get("longname") or it.get("symbol")
            sym = it.get("symbol") or ""
            exch = it.get("exchange") or ""
            reg = it.get("region") or ""
            out.append({
                "name": name,
                "symbol": sym,
                "exchange": exch,
                "region": reg
            })
        return Response({"results": out}, status=status.HTTP_200_OK)


class DashboardAPIView(APIView):
    permission_classes = [permissions.AllowAny]

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
