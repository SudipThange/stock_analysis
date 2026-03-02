from django.urls import path
from .views import StockListCreateAPIView, StockDetailAPIView, StockAnalyzeAPIView, StockSearchAPIView

urlpatterns = [
    path('', StockListCreateAPIView.as_view()),
    path('analyze/', StockAnalyzeAPIView.as_view()),
    path('search/', StockSearchAPIView.as_view()),
    path('<int:pk>/', StockDetailAPIView.as_view()),
]
