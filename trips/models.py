from django.db import models
from django.contrib.postgres.fields import ArrayField

from yatranepal.gis_fields import LineStringField, PointField, PolygonField
from users.models import UserProfile


class Destination(models.Model):
    DESTINATION_TYPE_CHOICES = [
        ("domestic", "Domestic"),
        ("international", "International"),
    ]

    ACTIVITY_TYPE_CHOICES = [
        ("sailing", "Sailing"),
        ("trekking", "Trekking"),
        ("rafting", "Rafting"),
        ("paragliding", "Paragliding"),
        ("safari", "Safari"),
        ("diving", "Diving"),
    ]

    DIFFICULTY_CHOICES = [
        ("easy", "Easy"),
        ("moderate", "Moderate"),
        ("hard", "Hard"),
        ("extreme", "Extreme"),
    ]

    name = models.CharField(max_length=100)
    region = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    destination_type = models.CharField(max_length=20, choices=DESTINATION_TYPE_CHOICES)
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPE_CHOICES)
    location = PointField(srid=4326)
    altitude_m = models.IntegerField(default=0)
    distance_from_ktm_km = models.IntegerField()
    permit_required = models.CharField(max_length=200, blank=True)
    description = models.TextField()
    best_season_months = ArrayField(models.IntegerField(), default=list)
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES)

    def __str__(self):
        return self.name


class Trip(models.Model):
    STATUS_CHOICES = [
        ("planned", "Planned"),
        ("active", "Active"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="trips")
    destination = models.ForeignKey(Destination, on_delete=models.CASCADE, related_name="trips")
    origin_city = models.CharField(max_length=100)
    origin_location = PointField(srid=4326)
    departure_date = models.DateField()
    return_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="planned")
    travel_rating = models.FloatField(null=True, blank=True)
    route_geom = LineStringField(srid=4326, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.origin_city} -> {self.destination.name}"


class TravelRating(models.Model):
    trip = models.OneToOneField(Trip, on_delete=models.CASCADE, related_name="rating")
    weather_score = models.FloatField()
    route_safety_score = models.FloatField()
    activity_fit_score = models.FloatField()
    infrastructure_score = models.FloatField()
    crowd_level_score = models.FloatField()
    disaster_risk_score = models.FloatField()
    overall_score = models.FloatField()
    recommendation = models.TextField()
    computed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Rating for trip {self.trip_id}: {self.overall_score}"


class LandslideZone(models.Model):
    RISK_LEVEL_CHOICES = [
        ("moderate", "Moderate"),
        ("high", "High"),
        ("very_high", "Very High"),
    ]

    name = models.CharField(max_length=200)
    highway = models.CharField(max_length=100)
    zone_polygon = PolygonField(srid=4326)
    risk_level = models.CharField(max_length=20, choices=RISK_LEVEL_CHOICES)
    active_months = ArrayField(models.IntegerField(), default=list)

    def __str__(self):
        return self.name
