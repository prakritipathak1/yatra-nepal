from datetime import date, datetime, timedelta

import requests
from django.utils import timezone

WMO_CODE_MAP = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    4: "Fog and low visibility",
    5: "Depositing rime fog",
    6: "Duststorm",
    7: "Sandstorm",
    8: "Smoke",
    9: "Volcanic ash",
    10: "Mist",
    11: "Patches of fog",
    12: "Shallow fog",
    13: "Ice fog",
    14: "Light haze",
    15: "Haze",
    16: "Dense haze",
    17: "Patchy light drizzle",
    18: "Patchy drizzle",
    19: "Freezing fog",
    20: "Reserved",
    21: "Light drizzle",
    22: "Moderate drizzle",
    23: "Dense drizzle",
    24: "Light freezing drizzle",
    25: "Freezing drizzle",
    26: "Dense freezing drizzle",
    27: "Sleet",
    28: "Light rain and drizzle",
    29: "Heavy rain and drizzle",
    30: "Light rain",
    31: "Moderate rain",
    32: "Heavy rain",
    33: "Very heavy rain",
    34: "Light freezing rain",
    35: "Freezing rain",
    36: "Heavy freezing rain",
    37: "Light snow",
    38: "Moderate snow",
    39: "Heavy snow",
    40: "Light snow grains",
    41: "Snow grains",
    42: "Moderate snow grains",
    43: "Heavy snow grains",
    44: "Light snow showers",
    45: "Moderate snow showers",
    46: "Heavy snow showers",
    47: "Light rain showers",
    48: "Moderate rain showers",
    49: "Heavy rain showers",
    50: "Drizzle",
    51: "Light drizzle",
    52: "Moderate drizzle",
    53: "Dense drizzle",
    54: "Light freezing drizzle",
    55: "Dense freezing drizzle",
    56: "Light freezing drizzle and rain",
    57: "Dense freezing drizzle and rain",
    58: "Light rain and drizzle",
    59: "Heavy rain and drizzle",
    60: "Light rain",
    61: "Moderate rain",
    62: "Heavy rain",
    63: "Very heavy rain",
    64: "Light freezing rain",
    65: "Freezing rain",
    66: "Heavy freezing rain",
    67: "Sleet",
    68: "Light snow and rain",
    69: "Heavy snow and rain",
    70: "Light snow",
    71: "Moderate snow",
    72: "Heavy snow",
    73: "Very heavy snow",
    74: "Light snow showers",
    75: "Moderate snow showers",
    76: "Heavy snow showers",
    77: "Snow grains",
    78: "Snow pellets",
    79: "Ice pellets",
    80: "Light rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    83: "Light sleet showers",
    84: "Moderate sleet showers",
    85: "Heavy sleet showers",
    86: "Sleet showers",
    87: "Light hail showers",
    88: "Moderate hail showers",
    89: "Heavy hail showers",
    90: "Light thunderstorm",
    91: "Thunderstorm",
    92: "Thunderstorm with light hail",
    93: "Thunderstorm with moderate hail",
    94: "Thunderstorm with heavy hail",
    95: "Severe thunderstorm",
    96: "Thunderstorm with slight hail",
    97: "Thunderstorm with hail",
    98: "Thunderstorm with heavy hail",
    99: "Violent thunderstorm",
}

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
OPEN_ELEVATION_URL = "https://api.open-elevation.com/api/v1/lookup"
USER_AGENT = "YatraNepal/1.0"


def decode_wmo_code(code):
    return WMO_CODE_MAP.get(int(code), "Unknown weather condition")


def flag_sailing_day(precipitation_probability, wind_speed_kmh, weather_code):
    return (
        int(precipitation_probability) < 30
        and float(wind_speed_kmh) < 25
        and int(weather_code) < 60
    )


def fetch_open_meteo(latitude, longitude, forecast_days=7):
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "temperature_2m,precipitation_probability,weathercode,windspeed_10m",
        "daily": "weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        "timezone": "Asia/Kathmandu",
        "forecast_days": max(1, min(7, forecast_days)),
    }
    response = requests.get(OPEN_METEO_URL, params=params, timeout=15)
    response.raise_for_status()
    return response.json()


def fetch_nominatim_search(query):
    headers = {"User-Agent": USER_AGENT}
    params = {"q": query, "format": "json", "countrycodes": "NP", "limit": 5}
    response = requests.get(NOMINATIM_SEARCH_URL, params=params, headers=headers, timeout=15)
    response.raise_for_status()
    return response.json()


def fetch_nominatim_reverse(latitude, longitude):
    headers = {"User-Agent": USER_AGENT}
    params = {"format": "json", "lat": latitude, "lon": longitude}
    response = requests.get(NOMINATIM_REVERSE_URL, params=params, headers=headers, timeout=15)
    response.raise_for_status()
    return response.json()


def fetch_open_elevation(latitude, longitude):
    params = {"locations": f"{latitude},{longitude}"}
    response = requests.get(OPEN_ELEVATION_URL, params=params, timeout=15)
    response.raise_for_status()
    return response.json()


def synthesize_forecast(destination, start_date, end_date):
    days = []
    total_days = (end_date - start_date).days + 1
    baseline = 18.0 if destination.altitude_m < 1000 else 9.0
    for offset in range(total_days):
        forecast_date = start_date + timedelta(days=offset)
        rainy = forecast_date.month in {6, 7, 8, 9}
        weather_code = 61 if rainy else 1
        temp_max = baseline + (4 - abs(3 - offset % 7))
        temp_min = temp_max - 7
        precipitation = 55 if rainy else 20
        wind_speed = 14.0 if rainy else 18.0
        days.append(
            {
                "date": forecast_date,
                "temp_max_c": round(temp_max, 1),
                "temp_min_c": round(temp_min, 1),
                "precipitation_probability": precipitation,
                "weather_code": weather_code,
                "weather_label": decode_wmo_code(weather_code),
                "wind_speed_kmh": wind_speed,
                "is_sailing_suitable": flag_sailing_day(precipitation, wind_speed, weather_code),
            }
        )
    return days


def build_forecast_days(destination, open_meteo_payload, start_date, end_date):
    daily = open_meteo_payload.get("daily", {})
    dates = daily.get("time", [])
    weather_codes = daily.get("weathercode", [])
    temp_max = daily.get("temperature_2m_max", [])
    temp_min = daily.get("temperature_2m_min", [])
    precip_max = daily.get("precipitation_probability_max", [])
    days = []
    for index, date_str in enumerate(dates):
        current_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        if current_date < start_date or current_date > end_date:
            continue
        code = int(weather_codes[index]) if index < len(weather_codes) else 1
        max_temp = float(temp_max[index]) if index < len(temp_max) else 0.0
        min_temp = float(temp_min[index]) if index < len(temp_min) else 0.0
        precip = int(precip_max[index]) if index < len(precip_max) else 0
        wind_speed = 18.0 if destination.altitude_m < 2000 else 22.0
        days.append(
            {
                "date": current_date,
                "temp_max_c": max_temp,
                "temp_min_c": min_temp,
                "precipitation_probability": precip,
                "weather_code": code,
                "weather_label": decode_wmo_code(code),
                "wind_speed_kmh": wind_speed,
                "is_sailing_suitable": flag_sailing_day(precip, wind_speed, code),
            }
        )
    if not days:
        return synthesize_forecast(destination, start_date, end_date)
    return days
