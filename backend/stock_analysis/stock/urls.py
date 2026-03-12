from django.urls import path
from .views import StockListCreateAPIView, StockDetailAPIView, StockAnalyzeAPIView, StockSearchAPIView, ExploreGoldSilverAPIView, CompareStocksAPIView, StockRiskCategorizationAPIView, StockPortfolioClusterAPIView, StockForecastAPIView

urlpatterns = [
    path('', StockListCreateAPIView.as_view()),
    path('analyze/', StockAnalyzeAPIView.as_view()),
    path('search/', StockSearchAPIView.as_view()),
    path('risk-categorization/', StockRiskCategorizationAPIView.as_view()),
    path('portfolio-cluster/', StockPortfolioClusterAPIView.as_view()),
    path('metals/', ExploreGoldSilverAPIView.as_view()),
    path('compare/', CompareStocksAPIView.as_view()),
    path('forecast/', StockForecastAPIView.as_view()),
    path('<int:pk>/', StockDetailAPIView.as_view()),
]
