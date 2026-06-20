from django.contrib.auth.models import User
from django.db import models

from yatranepal.gis_fields import PointField


class UserProfile(models.Model):
    USER_TYPE_CHOICES = [
        ("nepali", "Nepali Traveler"),
        ("foreign", "Foreign Tourist"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES)
    home_city = models.CharField(max_length=100)
    home_location = PointField(srid=4326, null=True, blank=True)
    nationality = models.CharField(max_length=50)
    phone = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} ({self.home_city})"
