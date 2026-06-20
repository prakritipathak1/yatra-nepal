from datetime import timedelta

from django.core.cache import cache
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from risk.models import BipadIncident
from risk.services import compute_risk_score, fetch_bipad
from trips.models import Destination


class RiskView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, dest_id, month):
        destination = get_object_or_404(Destination, pk=dest_id)
        payload = compute_risk_score(destination, int(month))
        return Response(
            {
                "destination": destination.name,
                "destination_id": destination.id,
                "month": int(month),
                "average_probability": payload["average_probability"],
                "risks": payload["risks"],
            }
        )


class BipadAlertsView(APIView):
    permission_classes = [permissions.AllowAny]
    CACHE_TTL_SECONDS = 60 * 30

    def get(self, request, district):
        cache_key = f"bipad-alerts:{district.lower()}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        try:
            incidents, _ = fetch_bipad(
                district=district,
                start_date=(timezone.now() - timedelta(days=30)).date().isoformat(),
                end_date=timezone.now().date().isoformat(),
            )
            payload = {
                "district": district,
                "incidents": [
                    {
                        "bipad_id": item["bipad_id"],
                        "incident_type": item["incident_type"],
                        "district": item["district"],
                        "location": (
                            {"lat": item["location"].y, "lon": item["location"].x} if item["location"] else None
                        ),
                        "incident_date": item["incident_date"].isoformat(),
                        "severity": item["severity"],
                        "deaths": item["deaths"],
                        "injured": item["injured"],
                        "description": item["description"],
                        "is_active": item["is_active"],
                    }
                    for item in incidents
                ],
                "source": "bipad-api",
            }
            cache.set(cache_key, payload, self.CACHE_TTL_SECONDS)
            return Response(payload)
        except Exception:
            incidents = BipadIncident.objects.filter(district__iexact=district, is_active=True).order_by("-incident_date")[:20]
            payload = {
                "district": district,
                "incidents": [
                    {
                        "bipad_id": item.bipad_id,
                        "incident_type": item.incident_type,
                        "district": item.district,
                        "location": (
                            {"lat": item.location.y, "lon": item.location.x} if item.location else None
                        ),
                        "incident_date": item.incident_date.isoformat(),
                        "severity": item.severity,
                        "deaths": item.deaths,
                        "injured": item.injured,
                        "description": item.description,
                        "is_active": item.is_active,
                    }
                    for item in incidents
                ],
                "source": "database",
            }
            cache.set(cache_key, payload, self.CACHE_TTL_SECONDS)
            return Response(payload)
