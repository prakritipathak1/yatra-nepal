import json
from statistics import mean

from django.db import connection
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from trips.models import Destination, LandslideZone, TravelRating, Trip
from trips.serializers import DestinationSerializer, TravelRatingSerializer, TripSerializer
from yatranepal.geometry import LineString, Point, parse_point_value
from weather.models import WeatherForecast
from weather.services import flag_sailing_day
from risk.models import DisasterRisk


def _compute_route_buffer_intersections(origin_point, destination_point):
    sql = """
        SELECT lz.id, lz.name, lz.highway, lz.risk_level, lz.active_months,
               ST_AsGeoJSON(ST_SetSRID(lz.zone_polygon::geometry, 4326)) AS polygon_geojson
        FROM trips_landslidezone lz
        WHERE ST_Intersects(
            ST_SetSRID(lz.zone_polygon::geometry, 4326),
            ST_Buffer(
                ST_MakeLine(
                    ST_SetSRID(ST_Point(%s, %s), 4326),
                    ST_SetSRID(ST_Point(%s, %s), 4326)
                )::geography,
                5000
            )::geometry
        )
    """
    with connection.cursor() as cursor:
        cursor.execute(
            sql,
            [origin_point.x, origin_point.y, destination_point.x, destination_point.y],
        )
        columns = [col[0] for col in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
    return rows

def _risk_level_score(risk_level):
    return {
        "moderate": 3.0,
        "high": 6.0,
        "very_high": 9.0,
    }.get(risk_level, 5.0)


def _infrastructure_score(destination):
    score = 7.5
    if destination.destination_type == "international":
        score = 6.5
    if destination.altitude_m > 3500:
        score -= 1.5
    if destination.distance_from_ktm_km > 300:
        score -= 0.5
    if destination.activity_type in {"trekking", "rafting", "paragliding"}:
        score += 0.5
    return max(1.0, min(10.0, score))


def _crowd_level_score(destination, month):
    busy_months = {10, 11, 12, 1, 2, 4, 5}
    peak = 8.5 if month in busy_months else 6.0
    if destination.activity_type == "trekking" and month in {10, 11, 3, 4}:
        peak = 9.0
    if destination.destination_type == "international":
        peak = 7.5
    return max(0.0, min(10.0, 10.0 - peak))


def _recommendation_text(overall, destination_name):
    if overall >= 8:
        return f"{destination_name} is in excellent condition for travel now."
    if overall >= 6:
        return f"{destination_name} is travelable, but check weather and alerts before departure."
    if overall >= 4:
        return f"{destination_name} has some seasonal risks. Recheck before confirming."
    return f"{destination_name} is currently high risk. Delay the trip or change plans."


class DestinationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Destination.objects.all().order_by("name")
    serializer_class = DestinationSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        # Auto-seed update if international destinations exist or count is low
        if Destination.objects.filter(destination_type="international").exists() or Destination.objects.count() < 10:
            from django.core.management import call_command
            try:
                call_command("seed_destinations")
            except Exception:
                pass

        queryset = Destination.objects.all().order_by("name")
        destination_type = self.request.query_params.get("destination_type")
        activity_type = self.request.query_params.get("activity_type")
        if destination_type:
            queryset = queryset.filter(destination_type=destination_type)
        if activity_type:
            queryset = queryset.filter(activity_type=activity_type)
        return queryset


class TripViewSet(viewsets.ModelViewSet):
    serializer_class = TripSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = getattr(self.request.user, "profile", None)
        if not profile:
            return Trip.objects.none()
        return Trip.objects.filter(user=profile).select_related("destination", "user", "rating").order_by("-created_at")

    def perform_create(self, serializer):
        profile = getattr(self.request.user, "profile", None)
        if not profile:
            raise PermissionDenied("User profile is required to create a trip.")
        serializer.save(user=profile)


class RouteView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, origin_lat, origin_lon, dest_lat, dest_lon):
        origin_point = Point(float(origin_lon), float(origin_lat), srid=4326)
        destination_point = Point(float(dest_lon), float(dest_lat), srid=4326)
        route = {
            "type": "LineString",
            "coordinates": [[origin_point.x, origin_point.y], [destination_point.x, destination_point.y]],
        }
        hazard_rows = _compute_route_buffer_intersections(origin_point, destination_point)
        hazard_zones = []
        for row in hazard_rows:
            hazard_zones.append(
                {
                    "type": "Feature",
                    "geometry": row["polygon_geojson"] and json.loads(row["polygon_geojson"]),
                    "properties": {
                        "id": row["id"],
                        "name": row["name"],
                        "highway": row["highway"],
                        "risk_level": row["risk_level"],
                        "active_months": row["active_months"],
                    },
                }
            )
        return Response({"route": route, "hazard_zones": hazard_zones, "hazard_count": len(hazard_zones)})


class RatingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        profile = getattr(request.user, "profile", None)
        if not profile:
            return Response({"detail": "User profile not found."}, status=403)
        trip = get_object_or_404(Trip.objects.select_related("destination", "user"), pk=pk, user=profile)
        month = trip.departure_date.month
        weather_rows = WeatherForecast.objects.filter(destination=trip.destination, forecast_date__range=(trip.departure_date, trip.return_date))
        if weather_rows.exists():
            weather_score = mean(10.0 if row.is_sailing_suitable else 4.0 for row in weather_rows)
        else:
            weather_score = 5.0

        origin_coords = parse_point_value(trip.origin_location)
        destination_coords = parse_point_value(trip.destination.location)
        if origin_coords and destination_coords:
            origin_point = Point(origin_coords[0], origin_coords[1], srid=4326)
            destination_point = Point(destination_coords[0], destination_coords[1], srid=4326)
            hazard_rows = _compute_route_buffer_intersections(origin_point, destination_point)
        else:
            hazard_rows = []
        if hazard_rows:
            average_risk = mean(_risk_level_score(row["risk_level"]) for row in hazard_rows)
            route_safety_score = max(0.0, min(10.0, 10.0 - average_risk))
        else:
            route_safety_score = 10.0

        activity_fit_score = 10.0 if month in trip.destination.best_season_months else 5.5
        infrastructure_score = _infrastructure_score(trip.destination)
        crowd_level_score = _crowd_level_score(trip.destination, month)

        disaster_risks = DisasterRisk.objects.filter(destination=trip.destination, month=month)
        if disaster_risks.exists():
            avg_probability = mean(risk.probability_percent for risk in disaster_risks)
            disaster_risk_score = max(0.0, min(10.0, 10.0 - (avg_probability / 10.0)))
        else:
            disaster_risk_score = 7.0 if month in {6, 7, 8, 9} else 8.5

        overall = round(
            (weather_score * 0.25)
            + (route_safety_score * 0.20)
            + (activity_fit_score * 0.20)
            + (infrastructure_score * 0.15)
            + (crowd_level_score * 0.10)
            + (disaster_risk_score * 0.10),
            1,
        )
        recommendation = _recommendation_text(overall, trip.destination.name)

        rating, _ = TravelRating.objects.update_or_create(
            trip=trip,
            defaults={
                "weather_score": round(weather_score, 1),
                "route_safety_score": round(route_safety_score, 1),
                "activity_fit_score": round(activity_fit_score, 1),
                "infrastructure_score": round(infrastructure_score, 1),
                "crowd_level_score": round(crowd_level_score, 1),
                "disaster_risk_score": round(disaster_risk_score, 1),
                "overall_score": overall,
                "recommendation": recommendation,
            },
        )
        trip.travel_rating = overall
        trip.save(update_fields=["travel_rating"])
        return Response(TravelRatingSerializer(rating).data)


class LandslideZonesListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.core.management import call_command
        from trips.models import LandslideZone
        if LandslideZone.objects.count() < 8:
            try:
                call_command("seed_landslide_zones")
            except Exception as e:
                print("Failed to auto-seed landslide zones:", e)

        sql = """
            SELECT lz.id, lz.name, lz.highway, lz.risk_level, lz.active_months,
                   ST_AsGeoJSON(ST_SetSRID(lz.zone_polygon::geometry, 4326)) AS polygon_geojson
            FROM trips_landslidezone lz
        """
        with connection.cursor() as cursor:
            cursor.execute(sql)
            columns = [col[0] for col in cursor.description]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

        hazard_zones = []
        for row in rows:
            hazard_zones.append(
                {
                    "type": "Feature",
                    "geometry": row["polygon_geojson"] and json.loads(row["polygon_geojson"]),
                    "properties": {
                        "id": row["id"],
                        "name": row["name"],
                        "highway": row["highway"],
                        "risk_level": row["risk_level"],
                        "active_months": row["active_months"],
                    },
                }
            )
        return Response({"hazard_zones": hazard_zones})
