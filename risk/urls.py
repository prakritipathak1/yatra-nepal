from django.urls import path

from risk.views import BipadAlertsView, RiskView

urlpatterns = [
    path("risk/<int:dest_id>/<int:month>/", RiskView.as_view(), name="risk"),
    path("bipad/alerts/<str:district>/", BipadAlertsView.as_view(), name="bipad-alerts"),
]
