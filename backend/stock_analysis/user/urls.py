from django.urls import path
from .views import RegisterUserAPI, LoginUserAPI, LogoutUserAPI, UserProfileAPI
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('', RegisterUserAPI.as_view()),
    path('login/', LoginUserAPI.as_view()),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutUserAPI.as_view()),
    path('profile/', UserProfileAPI.as_view()),
]
