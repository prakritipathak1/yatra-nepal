from django.db import models

from trips.models import Destination


class WeatherForecast(models.Model):
    destination = models.ForeignKey(Destination, on_delete=models.CASCADE, related_name="weather_forecasts")
    forecast_date = models.DateField()
    temp_max_c = models.FloatField()
    temp_min_c = models.FloatField()
    precipitation_probability = models.IntegerField()
    weather_code = models.IntegerField()
    wind_speed_kmh = models.FloatField()
    is_sailing_suitable = models.BooleanField(default=False)
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["destination", "forecast_date"]
        ordering = ["forecast_date"]

    def __str__(self):
        return f"{self.destination.name} {self.forecast_date}"
