from rest_framework import serializers

from risk.models import BipadIncident, DisasterRisk


class DisasterRiskSerializer(serializers.ModelSerializer):
    class Meta:
        model = DisasterRisk
        fields = [
            "risk_type",
            "probability_percent",
            "severity",
            "month",
            "source",
            "notes",
        ]


class BipadIncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = BipadIncident
        fields = [
            "bipad_id",
            "incident_type",
            "district",
            "location",
            "incident_date",
            "severity",
            "deaths",
            "injured",
            "description",
            "is_active",
            "fetched_at",
        ]
