from datetime import datetime, timedelta

from django.core.cache import cache
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from trips.models import Destination
from weather.models import WeatherForecast
from weather.serializers import WeatherForecastSerializer
from weather.services import (
    decode_wmo_code,
    fetch_nominatim_search,
    fetch_open_meteo,
    build_forecast_days,
    synthesize_forecast,
)


class WeatherView(APIView):
    permission_classes = [permissions.AllowAny]
    CACHE_TTL_SECONDS = 60 * 60 * 6

    def get(self, request, dest_id, from_date, to_date):
        destination = get_object_or_404(Destination, pk=dest_id)
        start_date = datetime.strptime(from_date, "%Y-%m-%d").date()
        end_date = datetime.strptime(to_date, "%Y-%m-%d").date()
        cache_key = f"weather:{destination.id}:{start_date}:{end_date}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        rows = WeatherForecast.objects.filter(destination=destination, forecast_date__range=(start_date, end_date)).order_by("forecast_date")
        fresh_cutoff = timezone.now() - timedelta(hours=6)
        if rows.exists() and rows.filter(fetched_at__gte=fresh_cutoff).count() == rows.count():
            serializer = WeatherForecastSerializer(rows, many=True)
            payload = {
                "destination": destination.name,
                "destination_id": destination.id,
                "from_date": start_date,
                "to_date": end_date,
                "forecasts": [
                    {
                        **item,
                        "weather_label": decode_wmo_code(item["weather_code"]),
                    }
                    for item in serializer.data
                ],
                "source": "database",
            }
            cache.set(cache_key, payload, self.CACHE_TTL_SECONDS)
            return Response(payload)

        forecast_days = min(7, max(1, (end_date - start_date).days + 1))
        try:
            api_payload = fetch_open_meteo(destination.location.y, destination.location.x, forecast_days=forecast_days)
            forecast_days_data = build_forecast_days(destination, api_payload, start_date, end_date)
            for item in forecast_days_data:
                WeatherForecast.objects.update_or_create(
                    destination=destination,
                    forecast_date=item["date"],
                    defaults={
                        "temp_max_c": item["temp_max_c"],
                        "temp_min_c": item["temp_min_c"],
                        "precipitation_probability": item["precipitation_probability"],
                        "weather_code": item["weather_code"],
                        "wind_speed_kmh": item["wind_speed_kmh"],
                        "is_sailing_suitable": item["is_sailing_suitable"],
                    },
                )
            rows = WeatherForecast.objects.filter(destination=destination, forecast_date__range=(start_date, end_date)).order_by("forecast_date")
            serializer = WeatherForecastSerializer(rows, many=True)
            payload = {
                "destination": destination.name,
                "destination_id": destination.id,
                "from_date": start_date,
                "to_date": end_date,
                "forecasts": [
                    {
                        **item,
                        "weather_label": decode_wmo_code(item["weather_code"]),
                    }
                    for item in serializer.data
                ],
                "source": "open-meteo",
            }
            cache.set(cache_key, payload, self.CACHE_TTL_SECONDS)
            return Response(payload)
        except Exception:
            fallback_days = synthesize_forecast(destination, start_date, end_date)
            payload = {
                "destination": destination.name,
                "destination_id": destination.id,
                "from_date": start_date,
                "to_date": end_date,
                "forecasts": fallback_days,
                "source": "fallback",
            }
            cache.set(cache_key, payload, self.CACHE_TTL_SECONDS)
            return Response(payload, status=status.HTTP_200_OK)


class GeocodeView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response([])
        cache_key = f"geocode:{query.lower()}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        try:
            results = fetch_nominatim_search(query)
            payload = [
                {
                    "display_name": item.get("display_name"),
                    "lat": float(item.get("lat")),
                    "lon": float(item.get("lon")),
                    "type": item.get("type"),
                    "class": item.get("class"),
                }
                for item in results
            ]
        except Exception:
            payload = []
        cache.set(cache_key, payload, 60 * 30)
        return Response(payload)
