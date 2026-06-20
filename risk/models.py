from django.db import models

from trips.models import Destination
from yatranepal.gis_fields import PointField


class DisasterRisk(models.Model):
    RISK_TYPE_CHOICES = [
        ("landslide", "Landslide"),
        ("flood", "Flash Flood"),
        ("earthquake", "Earthquake"),
        ("storm", "Thunderstorm"),
        ("river_overflow", "River Overflow"),
        ("road_closure", "Road Closure"),
    ]

    SEVERITY_CHOICES = [
        ("low", "Low"),
        ("moderate", "Moderate"),
        ("high", "High"),
        ("very_high", "Very High"),
    ]

    destination = models.ForeignKey(Destination, on_delete=models.CASCADE, related_name="disaster_risks")
    risk_type = models.CharField(max_length=30, choices=RISK_TYPE_CHOICES)
    probability_percent = models.IntegerField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    month = models.IntegerField()
    source = models.CharField(max_length=100)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.destination.name} {self.risk_type} {self.month}"


class BipadIncident(models.Model):
    bipad_id = models.IntegerField(unique=True)
    incident_type = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    location = PointField(srid=4326, null=True, blank=True)
    incident_date = models.DateField()
    severity = models.CharField(max_length=50)
    deaths = models.IntegerField(default=0)
    injured = models.IntegerField(default=0)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    fetched_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.incident_type} ({self.district})"
