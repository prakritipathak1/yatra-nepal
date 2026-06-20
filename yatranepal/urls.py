from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("users.urls")),
    path("api/", include("trips.urls")),
    path("api/", include("weather.urls")),
    path("api/", include("risk.urls")),
    path("", include("frontend.urls")),
]
