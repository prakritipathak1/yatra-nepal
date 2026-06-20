from django.core.management.base import BaseCommand

from trips.models import Destination
from yatranepal.geometry import Point


class Command(BaseCommand):
    help = "Insert the default YatraNepal destinations."

    def handle(self, *args, **options):
        # Purge international destinations
        Destination.objects.filter(destination_type="international").delete()

        destinations = [
            {
                "name": "Fewa Lake Pokhara",
                "region": "Gandaki Province",
                "district": "Kaski",
                "destination_type": "domestic",
                "activity_type": "sailing",
                "location": Point(83.9556, 28.2096, srid=4326),
                "altitude_m": 742,
                "distance_from_ktm_km": 200,
                "permit_required": "None",
                "description": "A calm lake destination for boating, sunrise views, and relaxed travel planning in Pokhara.",
                "best_season_months": [9, 10, 11, 12, 1, 2, 3],
                "difficulty": "easy",
            },
            {
                "name": "Everest Base Camp",
                "region": "Koshi Province",
                "district": "Solukhumbu",
                "destination_type": "domestic",
                "activity_type": "trekking",
                "location": Point(86.8528, 28.0026, srid=4326),
                "altitude_m": 5364,
                "distance_from_ktm_km": 145,
                "permit_required": "Khumbu Pasang Lhamu Rural Municipality permit and Sagarmatha National Park entry permit",
                "description": "A world-famous high-altitude trek with dramatic alpine scenery and seasonal weather sensitivity.",
                "best_season_months": [3, 4, 5, 9, 10, 11],
                "difficulty": "extreme",
            },
            {
                "name": "Trishuli River",
                "region": "Bagmati Province",
                "district": "Nuwakot",
                "destination_type": "domestic",
                "activity_type": "rafting",
                "location": Point(84.9742, 27.9939, srid=4326),
                "altitude_m": 500,
                "distance_from_ktm_km": 85,
                "permit_required": "Safety briefing and rafting operator permit",
                "description": "A classic rafting river with seasonal flow changes and strong adventure appeal near Kathmandu.",
                "best_season_months": [9, 10, 11, 3, 4, 5],
                "difficulty": "moderate",
            },
            {
                "name": "Annapurna Circuit (Besisahar)",
                "region": "Gandaki Province",
                "district": "Lamjung",
                "destination_type": "domestic",
                "activity_type": "trekking",
                "location": Point(84.3897, 28.2302, srid=4326),
                "altitude_m": 760,
                "distance_from_ktm_km": 175,
                "permit_required": "ACAP permit",
                "description": "Gateway to one of Nepal's most iconic trekking circuits with strong infrastructure and rich mountain culture.",
                "best_season_months": [3, 4, 5, 9, 10, 11],
                "difficulty": "hard",
            },
            {
                "name": "Bardiya NP",
                "region": "Lumbini Province",
                "district": "Bardiya",
                "destination_type": "domestic",
                "activity_type": "safari",
                "location": Point(81.5042, 28.3974, srid=4326),
                "altitude_m": 150,
                "distance_from_ktm_km": 520,
                "permit_required": "National park entry permit",
                "description": "A lowland safari destination for wildlife watching, jungle walks, and river scenery.",
                "best_season_months": [10, 11, 12, 1, 2, 3],
                "difficulty": "easy",
            },
            {
                "name": "Sarangkot Pokhara",
                "region": "Gandaki Province",
                "district": "Kaski",
                "destination_type": "domestic",
                "activity_type": "paragliding",
                "location": Point(83.9361, 28.2422, srid=4326),
                "altitude_m": 1600,
                "distance_from_ktm_km": 205,
                "permit_required": "Paragliding operator briefing",
                "description": "A popular takeoff point above Pokhara for sunrise views and paragliding flights.",
                "best_season_months": [9, 10, 11, 12, 1, 2, 3, 4],
                "difficulty": "moderate",
            },
            {
                "name": "Chitwan National Park",
                "region": "Bagmati Province",
                "district": "Chitwan",
                "destination_type": "domestic",
                "activity_type": "safari",
                "location": Point(84.4162, 27.5317, srid=4326),
                "altitude_m": 150,
                "distance_from_ktm_km": 150,
                "permit_required": "Chitwan National Park entry permit",
                "description": "A UNESCO World Heritage site known for its rich biodiversity, one-horned rhinos, and Bengal tigers.",
                "best_season_months": [10, 11, 12, 1, 2, 3],
                "difficulty": "easy",
            },
            {
                "name": "Rara Lake",
                "region": "Karnali Province",
                "district": "Mugu",
                "destination_type": "domestic",
                "activity_type": "sailing",
                "location": Point(82.0833, 29.5333, srid=4326),
                "altitude_m": 2990,
                "distance_from_ktm_km": 650,
                "permit_required": "Rara National Park entry permit",
                "description": "The largest freshwater lake in Nepal, offering pristine scenery, wilderness camping, and boating.",
                "best_season_months": [3, 4, 5, 9, 10, 11],
                "difficulty": "moderate",
            },
            {
                "name": "Langtang Valley",
                "region": "Bagmati Province",
                "district": "Rasuwa",
                "destination_type": "domestic",
                "activity_type": "trekking",
                "location": Point(85.6178, 28.2144, srid=4326),
                "altitude_m": 3870,
                "distance_from_ktm_km": 130,
                "permit_required": "Langtang National Park entry permit and TIMS card",
                "description": "A beautiful glacier valley trek surrounded by pine forests, yak pastures, and high peaks.",
                "best_season_months": [3, 4, 5, 9, 10, 11],
                "difficulty": "hard",
            },
            {
                "name": "Ghorepani Poon Hill",
                "region": "Gandaki Province",
                "district": "Myagdi",
                "destination_type": "domestic",
                "activity_type": "trekking",
                "location": Point(83.7011, 28.4002, srid=4326),
                "altitude_m": 3210,
                "distance_from_ktm_km": 240,
                "permit_required": "ACAP entry permit and TIMS card",
                "description": "An extremely popular viewpoint trek offering sunrise vistas of the Annapurna and Dhaulagiri ranges.",
                "best_season_months": [9, 10, 11, 12, 1, 2, 3, 4, 5],
                "difficulty": "moderate",
            },
            {
                "name": "Gosaikunda Lake",
                "region": "Bagmati Province",
                "district": "Rasuwa",
                "destination_type": "domestic",
                "activity_type": "trekking",
                "location": Point(85.4925, 28.0801, srid=4326),
                "altitude_m": 4380,
                "distance_from_ktm_km": 140,
                "permit_required": "Langtang National Park entry permit and TIMS card",
                "description": "A sacred alpine freshwater lake destination of high cultural and natural value.",
                "best_season_months": [3, 4, 5, 9, 10, 11],
                "difficulty": "hard",
            },
            {
                "name": "Bhote Koshi River",
                "region": "Bagmati Province",
                "district": "Sindhupalchok",
                "destination_type": "domestic",
                "activity_type": "rafting",
                "location": Point(85.7833, 27.7667, srid=4326),
                "altitude_m": 800,
                "distance_from_ktm_km": 95,
                "permit_required": "Safety briefing and rafting operator permit",
                "description": "One of the steepest and most challenging rafting rivers in Nepal for wild whitewater adventures.",
                "best_season_months": [10, 11, 3, 4, 5],
                "difficulty": "hard",
            },
        ]

        created = 0
        updated = 0
        for item in destinations:
            obj, is_created = Destination.objects.update_or_create(
                name=item["name"],
                defaults=item,
            )
            if is_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded destinations: {created} created, {updated} updated."
            )
        )
