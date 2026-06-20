import os

from django.db import models

GIS_ENABLED = os.environ.get("YATRANEPAL_GIS_ENABLED", "1") == "1"

if GIS_ENABLED:
    from django.contrib.gis.db.models import LineStringField, PointField, PolygonField
else:
    class _GeometryTextField(models.TextField):
        def __init__(self, *args, **kwargs):
            kwargs.pop("srid", None)
            kwargs.pop("spatial_index", None)
            kwargs.pop("dim", None)
            kwargs.pop("geography", None)
            super().__init__(*args, **kwargs)

        def get_prep_value(self, value):
            if value is None:
                return None
            if hasattr(value, "wkt"):
                return value.wkt
            if hasattr(value, "geojson"):
                return value.geojson
            return str(value)

    class PointField(_GeometryTextField):
        pass

    class LineStringField(_GeometryTextField):
        pass

    class PolygonField(_GeometryTextField):
        pass
