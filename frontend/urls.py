from django.urls import path

from frontend.views import (
    DashboardView,
    IndexView,
    PlanTripView,
    MapConfigView,
    LoginView,
    SignupView,
    LogoutView,
    GisExplorerView,
)

urlpatterns = [
    path("", IndexView.as_view(), name="index"),
    path("plan/", PlanTripView.as_view(), name="plan-trip"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("gis-explorer/", GisExplorerView.as_view(), name="gis-explorer"),
    path("login/", LoginView.as_view(), name="login"),
    path("signup/", SignupView.as_view(), name="signup"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("api/map-config/", MapConfigView.as_view(), name="map-config"),
]
