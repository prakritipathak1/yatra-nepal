from rest_framework import serializers

from weather.models import WeatherForecast


class WeatherForecastSerializer(serializers.ModelSerializer):
    weather_label = serializers.SerializerMethodField()

    class Meta:
        model = WeatherForecast
        fields = [
            "forecast_date",
            "temp_max_c",
            "temp_min_c",
            "precipitation_probability",
            "weather_code",
            "weather_label",
            "wind_speed_kmh",
            "is_sailing_suitable",
            "fetched_at",
        ]

    def get_weather_label(self, obj):
        return getattr(obj, "weather_label", None)
