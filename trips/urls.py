from django.urls import include, path
from rest_framework.routers import DefaultRouter

from trips.views import DestinationViewSet, RatingView, RouteView, TripViewSet, LandslideZonesListView

router = DefaultRouter()
router.register(r"destinations", DestinationViewSet, basename="destination")
router.register(r"trips", TripViewSet, basename="trip")

urlpatterns = [
    path("", include(router.urls)),
    path("route/<str:origin_lat>/<str:origin_lon>/<str:dest_lat>/<str:dest_lon>/", RouteView.as_view(), name="route"),
    path("trips/<int:pk>/rating/", RatingView.as_view(), name="trip-rating"),
    path("landslide-zones/", LandslideZonesListView.as_view(), name="landslide-zones"),
]
