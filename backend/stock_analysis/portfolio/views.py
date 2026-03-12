from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import Portfolio
from .serializers import PortfolioSerializer


# ============================================
# 🔹 LIST & CREATE PORTFOLIO
# ============================================
class PortfolioListCreateAPIView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    # 📌 GET → Get All Portfolios
    def get(self, request):
        portfolios = Portfolio.objects.filter(owner=request.user).order_by('-created_at')
        serializer = PortfolioSerializer(portfolios, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # 📌 POST → Create Portfolio
    def post(self, request):
        serializer = PortfolioSerializer(data=request.data, context={'request': request})

        if serializer.is_valid():
            serializer.save(owner=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ============================================
# 🔹 RETRIEVE, UPDATE, DELETE PORTFOLIO
# ============================================
class PortfolioDetailAPIView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, request, pk):
        try:
            return Portfolio.objects.get(pk=pk, owner=request.user)
        except Portfolio.DoesNotExist:
            return None

    # 📌 GET → Get Single Portfolio
    def get(self, request, pk):
        portfolio = self.get_object(request, pk)

        if not portfolio:
            return Response(
                {"error": "Portfolio not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PortfolioSerializer(portfolio)
        return Response(serializer.data, status=status.HTTP_200_OK)


    # 📌 PUT → Update Entire Object
    def put(self, request, pk):
        portfolio = self.get_object(request, pk)

        if not portfolio:
            return Response(
                {"error": "Portfolio not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PortfolioSerializer(portfolio, data=request.data, context={'request': request})

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


    # 📌 PATCH → Partial Update
    def patch(self, request, pk):
        portfolio = self.get_object(request, pk)

        if not portfolio:
            return Response(
                {"error": "Portfolio not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PortfolioSerializer(
            portfolio,
            data=request.data,
            partial=True,
            context={'request': request}
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


    # 📌 DELETE → Remove Portfolio
    def delete(self, request, pk):
        portfolio = self.get_object(request, pk)

        if not portfolio:
            return Response(
                {"error": "Portfolio not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        portfolio.delete()
        return Response(
            {"message": "Portfolio deleted successfully"},
            status=status.HTTP_204_NO_CONTENT
        )