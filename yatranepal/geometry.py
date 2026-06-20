import os
import re

GIS_ENABLED = os.environ.get("YATRANEPAL_GIS_ENABLED", "1") == "1"


def _parse_point_wkt(value):
    match = re.search(r"POINT\s*\(([-0-9.]+)\s+([-0-9.]+)\)", value or "", re.IGNORECASE)
    if not match:
        return None
    return float(match.group(1)), float(match.group(2))


def parse_point_value(value):
    if value is None:
        return None
    if hasattr(value, "x") and hasattr(value, "y"):
        return float(value.x), float(value.y)
    if isinstance(value, str):
        return _parse_point_wkt(value)
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        return float(value[0]), float(value[1])
    if isinstance(value, dict):
        if "coordinates" in value and len(value["coordinates"]) >= 2:
            return float(value["coordinates"][0]), float(value["coordinates"][1])
        if "lon" in value and "lat" in value:
            return float(value["lon"]), float(value["lat"])
    return None


def parse_linestring_value(value):
    if value is None:
        return None
    if hasattr(value, "coords"):
        return [list(point[:2]) for point in value.coords]
    if isinstance(value, str):
        match = re.search(r"LINESTRING\s*\((.+)\)", value or "", re.IGNORECASE)
        if not match:
            return None
        coordinates = []
        for pair in match.group(1).split(","):
            pieces = pair.strip().split()
            if len(pieces) >= 2:
                coordinates.append([float(pieces[0]), float(pieces[1])])
        return coordinates or None
    if isinstance(value, list):
        return [list(point[:2]) for point in value if isinstance(point, (list, tuple)) and len(point) >= 2]
    return None

if GIS_ENABLED:
    from django.contrib.gis.geos import LineString, Point, Polygon
else:
    class Point:
        def __init__(self, x, y, srid=None):
            self.x = float(x)
            self.y = float(y)
            self.srid = srid

        @property
        def coords(self):
            return (self.x, self.y)

        @property
        def wkt(self):
            return f"POINT ({self.x} {self.y})"

        def __iter__(self):
            yield self.x
            yield self.y

    class LineString:
        def __init__(self, *points, srid=None):
            self.coords = [tuple(point[:2]) if isinstance(point, (list, tuple)) else (point.x, point.y) for point in points]
            self.srid = srid

        @property
        def wkt(self):
            points = ", ".join(f"{x} {y}" for x, y in self.coords)
            return f"LINESTRING ({points})"

    class Polygon:
        def __init__(self, coords, srid=None):
            self.coords = [tuple(point[:2]) if isinstance(point, (list, tuple)) else point for point in coords]
            self.srid = srid

        @property
        def wkt(self):
            points = ", ".join(f"{x} {y}" for x, y in self.coords)
            return f"POLYGON (({points}))"
