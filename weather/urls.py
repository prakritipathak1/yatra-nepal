from django.urls import path

from weather.views import GeocodeView, WeatherView

urlpatterns = [
    path("weather/<int:dest_id>/<str:from_date>/<str:to_date>/", WeatherView.as_view(), name="weather"),
    path("geocode/", GeocodeView.as_view(), name="geocode"),
]
