from rest_framework import serializers

from trips.models import Destination, LandslideZone, TravelRating, Trip
from yatranepal.geometry import LineString, Point, parse_linestring_value, parse_point_value
from users.models import UserProfile


class DestinationSerializer(serializers.ModelSerializer):
    location = serializers.SerializerMethodField()

    class Meta:
        model = Destination
        fields = [
            "id",
            "name",
            "region",
            "district",
            "destination_type",
            "activity_type",
            "location",
            "altitude_m",
            "distance_from_ktm_km",
            "permit_required",
            "description",
            "best_season_months",
            "difficulty",
        ]

    def get_location(self, obj):
        parsed = parse_point_value(obj.location)
        if not parsed:
            return None
        lon, lat = parsed
        return {
            "lat": lat,
            "lon": lon,
            "coordinates": [lon, lat],
        }


class LandslideZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = LandslideZone
        fields = ["id", "name", "highway", "zone_polygon", "risk_level", "active_months"]


class TravelRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelRating
        fields = [
            "weather_score",
            "route_safety_score",
            "activity_fit_score",
            "infrastructure_score",
            "crowd_level_score",
            "disaster_risk_score",
            "overall_score",
            "recommendation",
            "computed_at",
        ]


class TripSerializer(serializers.ModelSerializer):
    destination_id = serializers.PrimaryKeyRelatedField(
        source="destination", queryset=Destination.objects.all(), write_only=True
    )
    destination = DestinationSerializer(read_only=True)
    origin_lat = serializers.FloatField(write_only=True)
    origin_lon = serializers.FloatField(write_only=True)
    origin_location = serializers.SerializerMethodField(read_only=True)
    route_geojson = serializers.SerializerMethodField(read_only=True)
    rating = TravelRatingSerializer(read_only=True)

    class Meta:
        model = Trip
        fields = [
            "id",
            "user",
            "destination",
            "destination_id",
            "origin_city",
            "origin_lat",
            "origin_lon",
            "origin_location",
            "departure_date",
            "return_date",
            "status",
            "travel_rating",
            "route_geojson",
            "rating",
            "created_at",
        ]
        read_only_fields = ["user", "travel_rating", "created_at"]

    def get_origin_location(self, obj):
        parsed = parse_point_value(obj.origin_location)
        if not parsed:
            return None
        lon, lat = parsed
        return {"lat": lat, "lon": lon, "coordinates": [lon, lat]}

    def get_route_geojson(self, obj):
        coordinates = parse_linestring_value(obj.route_geom)
        if not coordinates:
            return None
        return {
            "type": "LineString",
            "coordinates": coordinates,
        }

    def create(self, validated_data):
        origin_lat = validated_data.pop("origin_lat")
        origin_lon = validated_data.pop("origin_lon")
        destination = validated_data["destination"]
        origin_point = Point(origin_lon, origin_lat, srid=4326)
        destination_point = parse_point_value(destination.location)
        if destination_point:
            destination_lon, destination_lat = destination_point
        else:
            destination_lon, destination_lat = 0.0, 0.0
        route_geom = LineString((origin_lon, origin_lat), (destination_lon, destination_lat), srid=4326)
        trip = Trip.objects.create(origin_location=origin_point, route_geom=route_geom, **validated_data)
        return trip
