from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Authentication endpoints
    path('auth/login/', views.CustomTokenObtainPairView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', views.JWTLogoutView.as_view(), name='logout'),
    
    # Current user endpoints (self-management)
    path('whoami/', views.WhoAmI.as_view(), name='whoami'),  # Quick auth check
    path('profile/', views.UserProfileView.as_view(), name='profile'),  # Full profile with preferences
    
    # User management endpoints (admin/staff operations)
    path('', views.UserListView.as_view(), name='user_list'),  # GET, POST
    path('<int:pk>/', views.UserDetailView.as_view(), name='user_detail'),  # GET, PUT, DELETE
]