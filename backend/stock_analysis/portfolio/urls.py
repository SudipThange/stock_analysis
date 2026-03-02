from django.urls import path
from .views import PortfolioListCreateAPIView, PortfolioDetailAPIView

urlpatterns = [
    path('', PortfolioListCreateAPIView.as_view()),
    path('<int:pk>/', PortfolioDetailAPIView.as_view()),
]