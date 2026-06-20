from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from risk.models import BipadIncident
from risk.services import fetch_bipad, upsert_bipad_incidents


class Command(BaseCommand):
    help = "Fetch BIPAD incidents and upsert active alerts into the local database."

    def handle(self, *args, **options):
        start_date = (timezone.now() - timedelta(days=90)).date().isoformat()
        end_date = timezone.now().date().isoformat()
        incidents, payload = fetch_bipad(start_date=start_date, end_date=end_date)
        upsert_bipad_incidents(incidents)
        self.stdout.write(self.style.SUCCESS(f"Fetched {len(incidents)} BIPAD incidents."))
