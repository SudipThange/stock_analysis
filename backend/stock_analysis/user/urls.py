from django.urls import path
from .views import RegisterUserAPI, LoginUserAPI, LogoutUserAPI, UserProfileAPI

urlpatterns = [
    path('', RegisterUserAPI.as_view()),
    path('login/', LoginUserAPI.as_view()),
    path('logout/', LogoutUserAPI.as_view()),
    path('profile/', UserProfileAPI.as_view()),
]
