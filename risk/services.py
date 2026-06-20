from datetime import date, datetime
from statistics import mean

import requests
from django.utils import timezone

from risk.models import BipadIncident, DisasterRisk
from yatranepal.geometry import Point

BIPAD_API_URL = "https://bipadportal.gov.np/api/v1/incident/"
USER_AGENT = "YatraNepal/1.0"


def _parse_date(value):
    if isinstance(value, date):
        return value
    if not value:
        return timezone.now().date()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(str(value)[:10], fmt).date()
        except ValueError:
            continue
    return timezone.now().date()


def _extract_rows(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("results", "data", "incidents", "items"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
            if isinstance(value, dict):
                nested = value.get("results") or value.get("data")
                if isinstance(nested, list):
                    return nested
    return []


def _normalize_location(item):
    lat = item.get("lat") or item.get("latitude")
    lon = item.get("lon") or item.get("longitude")
    location = item.get("location")
    if isinstance(location, dict):
        lat = lat or location.get("lat") or location.get("latitude")
        lon = lon or location.get("lon") or location.get("lng") or location.get("longitude")
    if lat is None or lon is None:
        return None
    try:
        return Point(float(lon), float(lat), srid=4326)
    except (TypeError, ValueError):
        return None


def fetch_bipad(district=None, start_date=None, end_date=None, page=1):
    headers = {"User-Agent": USER_AGENT}
    params = {
        "district": district or "",
        "date_type": "date_of_incident",
        "start_date": start_date or "",
        "end_date": end_date or "",
        "page": page,
    }
    response = requests.get(BIPAD_API_URL, params=params, headers=headers, timeout=20)
    response.raise_for_status()
    payload = response.json()
    rows = _extract_rows(payload)
    incidents = []
    for item in rows:
        bipad_id = item.get("bipad_id") or item.get("id") or item.get("incident_id")
        if bipad_id is None:
            continue
        incidents.append(
            {
                "bipad_id": int(bipad_id),
                "incident_type": item.get("incident_type") or item.get("disaster_type") or item.get("type") or "Unknown",
                "district": item.get("district") or district or "Unknown",
                "location": _normalize_location(item),
                "incident_date": _parse_date(item.get("incident_date") or item.get("date_of_incident") or item.get("date")),
                "severity": item.get("severity") or item.get("impact") or item.get("level") or "unknown",
                "deaths": int(item.get("deaths") or item.get("death") or 0),
                "injured": int(item.get("injured") or item.get("injuries") or 0),
                "description": item.get("description") or item.get("details") or "",
                "is_active": bool(item.get("is_active", True)),
            }
        )
    return incidents, payload


def upsert_bipad_incidents(incidents):
    active_ids = []
    for item in incidents:
        active_ids.append(item["bipad_id"])
        BipadIncident.objects.update_or_create(
            bipad_id=item["bipad_id"],
            defaults={
                "incident_type": item["incident_type"],
                "district": item["district"],
                "location": item["location"],
                "incident_date": item["incident_date"],
                "severity": item["severity"],
                "deaths": item["deaths"],
                "injured": item["injured"],
                "description": item["description"],
                "is_active": item["is_active"],
            },
        )
    BipadIncident.objects.exclude(bipad_id__in=active_ids).update(is_active=False)
    return active_ids


def compute_risk_score(destination, month):
    risks = DisasterRisk.objects.filter(destination=destination, month=month)
    if not risks.exists():
        base_probability = 70 if month in {6, 7, 8, 9} else 30
        if destination.destination_type == "international":
            base_probability -= 10
        if destination.altitude_m > 3000:
            base_probability += 15
        return {
            "average_probability": max(0, min(100, base_probability)),
            "risks": [
                {
                    "risk_type": "landslide" if month in {6, 7, 8, 9} else "storm",
                    "probability_percent": max(0, min(100, base_probability)),
                    "severity": "high" if base_probability >= 60 else "moderate",
                    "source": "heuristic",
                    "notes": "Generated from destination seasonality and altitude.",
                }
            ],
        }
    serialized = [
        {
            "risk_type": risk.risk_type,
            "probability_percent": risk.probability_percent,
            "severity": risk.severity,
            "source": risk.source,
            "notes": risk.notes,
        }
        for risk in risks
    ]
    return {
        "average_probability": int(round(mean(risk.probability_percent for risk in risks))),
        "risks": serialized,
    }
