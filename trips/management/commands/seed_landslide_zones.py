from django.core.management.base import BaseCommand

from trips.models import LandslideZone
from yatranepal.geometry import Polygon


class Command(BaseCommand):
    help = "Insert monsoon landslide zones around Prithvi Highway."

    def handle(self, *args, **options):
        zones = [
            {
                "name": "Naubise Cut Slope",
                "highway": "Prithvi Highway",
                "coords": [
                    (85.0610, 27.6620),
                    (85.0810, 27.6620),
                    (85.0810, 27.6820),
                    (85.0610, 27.6820),
                    (85.0610, 27.6620),
                ],
                "risk_level": "high",
            },
            {
                "name": "Mugling Gorge Bend",
                "highway": "Prithvi Highway",
                "coords": [
                    (84.5280, 27.9360),
                    (84.5480, 27.9360),
                    (84.5480, 27.9560),
                    (84.5280, 27.9560),
                    (84.5280, 27.9360),
                ],
                "risk_level": "very_high",
            },
            {
                "name": "Kurintar Slip Zone",
                "highway": "Prithvi Highway",
                "coords": [
                    (84.5600, 27.9680),
                    (84.5800, 27.9680),
                    (84.5800, 27.9880),
                    (84.5600, 27.9880),
                    (84.5600, 27.9680),
                ],
                "risk_level": "high",
            },
            {
                "name": "Fisling Valley Wall",
                "highway": "Prithvi Highway",
                "coords": [
                    (84.5000, 28.0300),
                    (84.5200, 28.0300),
                    (84.5200, 28.0500),
                    (84.5000, 28.0500),
                    (84.5000, 28.0300),
                ],
                "risk_level": "moderate",
            },
            {
                "name": "Muglin Powerhouse Slope",
                "highway": "Prithvi Highway",
                "coords": [
                    (84.5400, 27.9200),
                    (84.5600, 27.9200),
                    (84.5600, 27.9400),
                    (84.5400, 27.9400),
                    (84.5400, 27.9200),
                ],
                "risk_level": "very_high",
            },
            {
                "name": "Dolalghat Slump Zone",
                "highway": "Araniko Highway",
                "coords": [
                    (85.7000, 27.6300),
                    (85.7200, 27.6300),
                    (85.7200, 27.6500),
                    (85.7000, 27.6500),
                    (85.7000, 27.6300),
                ],
                "risk_level": "high",
            },
            {
                "name": "Khurkot Slide",
                "highway": "BP Highway",
                "coords": [
                    (85.9800, 27.3800),
                    (86.0000, 27.3800),
                    (86.0000, 27.4000),
                    (85.9800, 27.4000),
                    (85.9800, 27.3800),
                ],
                "risk_level": "moderate",
            },
            {
                "name": "Bhiman Slope Failure",
                "highway": "BP Highway",
                "coords": [
                    (85.9200, 27.2800),
                    (85.9400, 27.2800),
                    (85.9400, 27.3000),
                    (85.9200, 27.3000),
                    (85.9200, 27.2800),
                ],
                "risk_level": "high",
            },
            {
                "name": "Jalbire Cliff Hazard",
                "highway": "Narayangadh-Mugling Road",
                "coords": [
                    (84.4500, 27.7800),
                    (84.4700, 27.7800),
                    (84.4700, 27.8000),
                    (84.4500, 27.8000),
                    (84.4500, 27.7800),
                ],
                "risk_level": "very_high",
            },
            {
                "name": "Siddhababa Rockfall",
                "highway": "Siddhartha Highway",
                "coords": [
                    (83.4500, 27.7500),
                    (83.4700, 27.7500),
                    (83.4700, 27.7700),
                    (83.4500, 27.7700),
                    (83.4500, 27.7500),
                ],
                "risk_level": "very_high",
            },
            {
                "name": "Syangja Slope Slip",
                "highway": "Siddhartha Highway",
                "coords": [
                    (83.8800, 28.0800),
                    (83.9000, 28.0800),
                    (83.9000, 28.1000),
                    (83.8800, 28.1000),
                    (83.8800, 28.0800),
                ],
                "risk_level": "moderate",
            },
        ]

        created = 0
        updated = 0
        for item in zones:
            polygon = Polygon(item["coords"], srid=4326)
            obj, is_created = LandslideZone.objects.update_or_create(
                name=item["name"],
                defaults={
                    "highway": item["highway"],
                    "zone_polygon": polygon,
                    "risk_level": item["risk_level"],
                    "active_months": [6, 7, 8, 9],
                },
            )
            if is_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(f"Seeded landslide zones: {created} created, {updated} updated."))
