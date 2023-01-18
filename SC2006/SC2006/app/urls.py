from django.contrib import admin
from django.urls import path
from app import views

app_name='app'

urlpatterns = [
    path('parking/',views.parking,name='parking'),
]
