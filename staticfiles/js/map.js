(function () {
  function normalizePoint(point) {
    if (!point) {
      return null;
    }
    if (Array.isArray(point) && point.length >= 2) {
      return { lat: Number(point[1]), lon: Number(point[0]) };
    }
    if (typeof point.lat === "number" && typeof point.lon === "number") {
      return point;
    }
      if (Array.isArray(point.coordinates) && point.coordinates.length >= 2) {
        return { lat: Number(point.coordinates[1]), lon: Number(point.coordinates[0]) };
      }
      if (point.type === "Point" && Array.isArray(point.coordinates)) {
        return { lat: Number(point.coordinates[1]), lon: Number(point.coordinates[0]) };
      }
    if (typeof point.latitude === "number" && typeof point.longitude === "number") {
      return { lat: point.latitude, lon: point.longitude };
    }
    if (point.location) {
      return normalizePoint(point.location);
    }
    return null;
  }

  function createLabeledIcon(label, color, sizeClass) {
    return L.divIcon({
      className: `yatranepal-marker ${sizeClass || ""}`,
      html: `<span style="background:${color};" class="marker-badge">${label}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -28],
    });
  }

  function createPulsingCircle(latlng, options = {}) {
    return L.circleMarker(latlng, {
      radius: 10,
      color: options.color || "#1D9E75",
      weight: 2,
      fillColor: options.fillColor || "#1D9E75",
      fillOpacity: 0.18,
      className: options.className || "route-pulse",
    });
  }

  async function fetchBipad(district) {
    if (!district) {
      return [];
    }
    if (window.YatraNepalAPI) {
      const data = await window.YatraNepalAPI.get(`/api/bipad/alerts/${encodeURIComponent(district)}/`);
      return data.incidents || [];
    }
    const response = await fetch(`/api/bipad/alerts/${encodeURIComponent(district)}/`);
    const data = await response.json();
    return data.incidents || [];
  }

  function initMap(containerId, origin, destination, routeGeoJSON, hazardZones) {
    const container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
    if (!container) {
      return null;
    }

    const originPoint = normalizePoint(origin);
    const destinationPoint = normalizePoint(destination);
    const map = L.map(containerId, { zoomControl: true });

    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    });
    const carto = L.tileLayer("https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 20,
    });
    const stamen = L.tileLayer("https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png", {
      attribution: "Map tiles by Stamen Design, under CC BY 3.0. Data by OpenStreetMap contributors.",
      maxZoom: 18,
    });

    osm.addTo(map);

    const routeLayer = L.layerGroup();
    const hazardLayer = L.layerGroup();
    const incidentLayer = L.layerGroup();

    if (routeGeoJSON && routeGeoJSON.route) {
      const routeCoords = routeGeoJSON.route.coordinates || routeGeoJSON.route.geometry?.coordinates;
      if (routeCoords && routeCoords.length) {
        L.geoJSON(routeGeoJSON.route, {
          style: {
            color: "#185FA5",
            weight: 4,
            opacity: 0.95,
            dashArray: "12, 8",
            lineCap: "round",
          },
          className: "route-line",
        }).addTo(routeLayer);

        const midpointIndex = Math.floor(routeCoords.length / 2);
        const midpoint = routeCoords[midpointIndex];
        if (midpoint) {
          createPulsingCircle([midpoint[1], midpoint[0]], {
            color: "#1D9E75",
            fillColor: "#1D9E75",
            className: "route-midpoint",
          })
            .bindPopup("<strong>Route midpoint</strong><br/>Approximately halfway along the journey.")
            .addTo(routeLayer);
        }
      }
    }

    if (hazardZones && hazardZones.length) {
      hazardZones.forEach((feature) => {
        L.geoJSON(feature, {
          style: {
            fillColor: "#E24B4A",
            fillOpacity: 0.25,
            color: "#A32D2D",
            weight: 1.5,
          },
          onEachFeature: (geojsonFeature, layer) => {
            const props = geojsonFeature.properties || {};
            layer.bindPopup(`<strong>${props.name || "Landslide zone"}</strong><br/>Risk: ${props.risk_level || "unknown"}`);
          },
        }).addTo(hazardLayer);
      });
    }

    const markers = [];
    if (originPoint) {
      const originMarker = L.marker([originPoint.lat, originPoint.lon], {
        icon: createLabeledIcon("A", "#185FA5"),
      }).bindPopup(`<strong>Origin</strong><br/>${origin && origin.name ? origin.name : "Starting point"}`);
      originMarker.addTo(map);
      markers.push(originMarker);
    }

    if (destinationPoint) {
      const destinationMarker = L.marker([destinationPoint.lat, destinationPoint.lon], {
        icon: createLabeledIcon("B", "#1D9E75"),
      }).bindPopup(`<strong>Destination</strong><br/>${destination && destination.name ? destination.name : "Arrival point"}`);
      destinationMarker.addTo(map);
      markers.push(destinationMarker);
    }

    if (routeGeoJSON && routeGeoJSON.hazard_zones) {
      routeGeoJSON.hazard_zones.forEach((feature) => {
        L.geoJSON(feature, {
          style: {
            fillColor: "#E24B4A",
            fillOpacity: 0.25,
            color: "#A32D2D",
            weight: 1.5,
          },
          onEachFeature: (geojsonFeature, layer) => {
            const props = geojsonFeature.properties || {};
            layer.bindPopup(`<strong>${props.name || "Landslide zone"}</strong><br/>Risk: ${props.risk_level || "unknown"}`);
          },
        }).addTo(hazardLayer);
      });
    }

    const layers = {
      "OpenStreetMap": osm,
      "CartoDB Positron": carto,
      "Stamen Terrain": stamen,
    };
    const overlays = {
      "Route": routeLayer,
      "Hazard Zones": hazardLayer,
      "BIPAD Incidents": incidentLayer,
    };

    routeLayer.addTo(map);
    hazardLayer.addTo(map);

    L.control.layers(layers, overlays, { collapsed: false }).addTo(map);

    const fitPoints = [];
    markers.forEach((marker) => fitPoints.push(marker.getLatLng()));
    if (routeGeoJSON && routeGeoJSON.route && routeGeoJSON.route.coordinates) {
      routeGeoJSON.route.coordinates.forEach((coord) => fitPoints.push(L.latLng(coord[1], coord[0])));
    }
    if (fitPoints.length) {
      map.fitBounds(L.latLngBounds(fitPoints).pad(0.2));
    }

    fetchBipad(destination && destination.district)
      .then((incidents) => {
        incidents.forEach((incident) => {
          const loc = normalizePoint(incident.location);
          if (!loc) {
            return;
          }
          const marker = L.circleMarker([loc.lat, loc.lon], {
            radius: 7,
            color: "#D97706",
            fillColor: "#F59E0B",
            fillOpacity: 0.9,
            weight: 2,
          }).bindPopup(
            `<strong>${incident.incident_type}</strong><br/>${incident.incident_date}<br/>Severity: ${incident.severity}`
          );
          marker.addTo(incidentLayer);
        });
        incidentLayer.addTo(map);
      })
      .catch(() => {
        incidentLayer.addTo(map);
      });

    return map;
  }

  window.initMap = initMap;
})();
