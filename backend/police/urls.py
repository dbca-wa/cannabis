from django.urls import path
from . import views


urlpatterns = [
    # Police Station endpoints
    path('stations/', views.PoliceStationListView.as_view(), name='station_list'),
    path('stations/<int:pk>/', views.PoliceStationDetailView.as_view(), name='station_detail'),
    
    # Police Officer endpoints  
    path('officers/', views.PoliceOfficerListView.as_view(), name='officer_list'),
    path('officers/<int:pk>/', views.PoliceOfficerDetailView.as_view(), name='officer_detail'),
]