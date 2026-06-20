(function () {
  let googleMapsPromise = null;

  function loadGoogleMapsScript() {
    if (googleMapsPromise) return googleMapsPromise;

    googleMapsPromise = new Promise(async (resolve, reject) => {
      if (typeof google !== 'undefined' && google.maps) {
        resolve(google);
        return;
      }

      try {
        const config = await window.YatraNepalAPI.get("/api/map-config/");
        const key = config.key || "";
        if (!key) {
          throw new Error("Google Maps API key not found in server settings.");
        }

        window.initGoogleMapsCallback = () => {
          resolve(google);
        };

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry,drawing,places&loading=async&callback=initGoogleMapsCallback`;
        script.async = true;
        script.defer = true;
        script.onerror = (err) => reject(new Error("Google Maps script failed to load."));
        document.head.appendChild(script);
      } catch (error) {
        reject(error);
      }
    });

    return googleMapsPromise;
  }

  // Start loading automatically in background on IIFE execution
  loadGoogleMapsScript().catch(err => console.warn("Background map script load:", err.message));

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

    const mapShell = {
      isLoaded: false,
      flyToBounds: (coordsList) => {
        if (mapShell.realMap) mapShell.realMap.flyToBounds(coordsList);
        else mapShell.pendingFlyTo = coordsList;
      },
      panTo: (latLng) => {
        if (mapShell.realMap) mapShell.realMap.panTo(latLng);
        else mapShell.pendingPanTo = latLng;
      },
      setZoom: (zoom) => {
        if (mapShell.realMap) mapShell.realMap.setZoom(zoom);
        else mapShell.pendingZoom = zoom;
      },
      invalidateSize: () => {}
    };

    container.innerHTML = `<div class="map-loading-placeholder" style="height:100%; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.02); color:#444441; font-weight:700;">Loading interactive map...</div>`;

    loadGoogleMapsScript().then(() => {
      container.innerHTML = "";

      const originPoint = normalizePoint(origin);
      const destinationPoint = normalizePoint(destination);
      const centerLatLng = originPoint ? { lat: originPoint.lat, lng: originPoint.lon } : { lat: 27.7172, lng: 85.3240 };

      const map = new google.maps.Map(container, {
        center: centerLatLng,
        zoom: 8,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      // --- Compass Rose & Heading ---
      const compassNeedle = document.getElementById("compass-needle");
      const compassRose = document.getElementById("compass-rose");
      if (compassNeedle && compassRose) {
        map.addListener('heading_changed', () => {
          const heading = map.getHeading() || 0;
          compassNeedle.style.transform = `rotate(${-heading}deg)`;
        });
        compassRose.addEventListener("click", () => {
          map.setHeading(0);
          map.setTilt(0);
        });
      }

      // --- Cursor Coordinates Inspector ---
      const cursorCoordsPanel = document.getElementById("cursor-coords-panel");
      if (cursorCoordsPanel) {
        map.addListener('mousemove', (event) => {
          const lat = event.latLng.lat().toFixed(5);
          const lng = event.latLng.lng().toFixed(5);
          cursorCoordsPanel.innerHTML = `Lat: ${lat} · Lon: ${lng}`;
        });
      }

      // --- Geodesic Ruler Tool ---
      let rulerEnabled = false;
      let rulerMarkers = [];
      let rulerPolyline = null;
      let rulerPoints = [];

      const btnToggleRuler = document.getElementById("btn-toggle-ruler");
      const rulerStatusBadge = document.getElementById("ruler-status-badge");
      const rulerInfoPanel = document.getElementById("ruler-info-panel");
      const rulerPointsCount = document.getElementById("ruler-points-count");
      const rulerDistanceVal = document.getElementById("ruler-distance-val");
      const btnClearRuler = document.getElementById("btn-clear-ruler");

      if (btnToggleRuler) {
        btnToggleRuler.addEventListener("click", () => {
          rulerEnabled = !rulerEnabled;
          if (rulerEnabled) {
            btnToggleRuler.classList.replace("btn-outline-info", "btn-info");
            if (rulerStatusBadge) {
              rulerStatusBadge.textContent = "Enabled";
              rulerStatusBadge.classList.replace("bg-secondary", "bg-light");
            }
            if (rulerInfoPanel) rulerInfoPanel.classList.remove("d-none");
            map.setOptions({ draggableCursor: 'crosshair' });
          } else {
            btnToggleRuler.classList.replace("btn-info", "btn-outline-info");
            if (rulerStatusBadge) {
              rulerStatusBadge.textContent = "Disabled";
              rulerStatusBadge.classList.replace("bg-light", "bg-secondary");
            }
            if (rulerInfoPanel) rulerInfoPanel.classList.add("d-none");
            map.setOptions({ draggableCursor: null });
          }
        });

        map.addListener('click', (event) => {
          if (!rulerEnabled) return;
          
          const latLng = event.latLng;
          const marker = new google.maps.Marker({
            position: latLng,
            map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: "#06b6d4",
              fillOpacity: 1,
              strokeWeight: 1.5,
              strokeColor: "#ffffff"
            }
          });
          rulerMarkers.push(marker);
          rulerPoints.push(latLng);

          if (rulerPointsCount) rulerPointsCount.textContent = rulerPoints.length;

          if (rulerPolyline) {
            rulerPolyline.setPath(rulerPoints);
          } else {
            rulerPolyline = new google.maps.Polyline({
              path: rulerPoints,
              strokeColor: "#06b6d4",
              strokeOpacity: 0.8,
              strokeWeight: 3,
              map: map
            });
          }

          let totalDist = 0;
          for (let i = 0; i < rulerPoints.length - 1; i++) {
            totalDist += google.maps.geometry.spherical.computeDistanceBetween(rulerPoints[i], rulerPoints[i+1]);
          }
          if (rulerDistanceVal) {
            rulerDistanceVal.textContent = `${(totalDist / 1000).toFixed(2)} km`;
          }
        });

        if (btnClearRuler) {
          btnClearRuler.addEventListener("click", () => {
            rulerMarkers.forEach(m => m.setMap(null));
            rulerMarkers = [];
            rulerPoints = [];
            if (rulerPolyline) {
              rulerPolyline.setMap(null);
              rulerPolyline = null;
            }
            if (rulerPointsCount) rulerPointsCount.textContent = "0";
            if (rulerDistanceVal) rulerDistanceVal.textContent = "0.00 km";
          });
        }
      }

      // --- Three GIS Overlay Boundary Layers (Province, District, Local Level) ---
      const switchProvince = document.getElementById("switch-province-boundaries");
      const switchDistrict = document.getElementById("switch-district-boundaries");
      const switchLocal = document.getElementById("switch-local-boundaries");

      // 1. Province Boundaries (Bagmati & Gandaki) - Restricted south of Nepal-China border
      const bagmatiCoords = [
        { lat: 28.05, lng: 85.0 },
        { lat: 28.12, lng: 85.7 },
        { lat: 27.98, lng: 86.3 },
        { lat: 27.20, lng: 86.2 },
        { lat: 27.25, lng: 85.1 },
        { lat: 27.60, lng: 84.7 },
        { lat: 27.90, lng: 84.8 },
        { lat: 28.05, lng: 85.0 }
      ];
      const gandakiCoords = [
        { lat: 28.75, lng: 83.8 },
        { lat: 28.70, lng: 84.6 },
        { lat: 28.05, lng: 85.0 },
        { lat: 27.90, lng: 84.8 },
        { lat: 27.60, lng: 84.7 },
        { lat: 27.45, lng: 83.8 },
        { lat: 27.80, lng: 83.1 },
        { lat: 28.45, lng: 83.0 },
        { lat: 28.75, lng: 83.8 }
      ];

      // 2. District Boundaries (Kathmandu, Kaski, Chitwan)
      const kathmanduDistrictCoords = [
        { lat: 27.80, lng: 85.20 },
        { lat: 27.78, lng: 85.45 },
        { lat: 27.65, lng: 85.48 },
        { lat: 27.58, lng: 85.28 },
        { lat: 27.64, lng: 85.18 },
        { lat: 27.80, lng: 85.20 }
      ];
      const kaskiDistrictCoords = [
        { lat: 28.45, lng: 83.75 },
        { lat: 28.42, lng: 84.18 },
        { lat: 28.25, lng: 84.22 },
        { lat: 28.12, lng: 83.82 },
        { lat: 28.18, lng: 83.70 },
        { lat: 28.45, lng: 83.75 }
      ];
      const chitwanDistrictCoords = [
        { lat: 27.75, lng: 84.10 },
        { lat: 27.70, lng: 84.80 },
        { lat: 27.42, lng: 84.75 },
        { lat: 27.35, lng: 84.20 },
        { lat: 27.50, lng: 83.95 },
        { lat: 27.75, lng: 84.10 }
      ];

      // 3. Local Level Boundaries (KTM Metropolitan, Pokhara Metropolitan, Bharatpur Metropolitan)
      const ktmLocalCoords = [
        { lat: 27.74, lng: 85.30 },
        { lat: 27.73, lng: 85.35 },
        { lat: 27.68, lng: 85.34 },
        { lat: 27.69, lng: 85.28 },
        { lat: 27.74, lng: 85.30 }
      ];
      const pokharaLocalCoords = [
        { lat: 28.28, lng: 83.92 },
        { lat: 28.27, lng: 84.05 },
        { lat: 28.18, lng: 84.02 },
        { lat: 28.17, lng: 83.90 },
        { lat: 28.28, lng: 83.92 }
      ];
      const bharatpurLocalCoords = [
        { lat: 27.70, lng: 84.40 },
        { lat: 27.68, lng: 84.48 },
        { lat: 27.58, lng: 84.45 },
        { lat: 27.60, lng: 84.35 },
        { lat: 27.70, lng: 84.40 }
      ];

      // Draw Province Polygons
      const provincePolys = [
        new google.maps.Polygon({
          paths: bagmatiCoords,
          strokeColor: "#f59e0b",
          strokeOpacity: 0.6,
          strokeWeight: 2.2,
          fillColor: "#f59e0b",
          fillOpacity: 0.015,
          map: map,
          visible: switchProvince ? switchProvince.checked : true
        }),
        new google.maps.Polygon({
          paths: gandakiCoords,
          strokeColor: "#10b981",
          strokeOpacity: 0.6,
          strokeWeight: 2.2,
          fillColor: "#10b981",
          fillOpacity: 0.015,
          map: map,
          visible: switchProvince ? switchProvince.checked : true
        })
      ];

      // Draw District Polys
      const districtPolys = [
        new google.maps.Polygon({
          paths: kathmanduDistrictCoords,
          strokeColor: "#a855f7",
          strokeOpacity: 0.5,
          strokeWeight: 1.6,
          fillColor: "#a855f7",
          fillOpacity: 0.01,
          map: map,
          visible: switchDistrict ? switchDistrict.checked : true
        }),
        new google.maps.Polygon({
          paths: kaskiDistrictCoords,
          strokeColor: "#a855f7",
          strokeOpacity: 0.5,
          strokeWeight: 1.6,
          fillColor: "#a855f7",
          fillOpacity: 0.01,
          map: map,
          visible: switchDistrict ? switchDistrict.checked : true
        }),
        new google.maps.Polygon({
          paths: chitwanDistrictCoords,
          strokeColor: "#a855f7",
          strokeOpacity: 0.5,
          strokeWeight: 1.6,
          fillColor: "#a855f7",
          fillOpacity: 0.01,
          map: map,
          visible: switchDistrict ? switchDistrict.checked : true
        })
      ];

      // Draw Local Level Polys
      const localLevelPolys = [
        new google.maps.Polygon({
          paths: ktmLocalCoords,
          strokeColor: "#06b6d4",
          strokeOpacity: 0.7,
          strokeWeight: 1.2,
          fillColor: "#06b6d4",
          fillOpacity: 0.01,
          map: map,
          visible: switchLocal ? switchLocal.checked : true
        }),
        new google.maps.Polygon({
          paths: pokharaLocalCoords,
          strokeColor: "#06b6d4",
          strokeOpacity: 0.7,
          strokeWeight: 1.2,
          fillColor: "#06b6d4",
          fillOpacity: 0.01,
          map: map,
          visible: switchLocal ? switchLocal.checked : true
        }),
        new google.maps.Polygon({
          paths: bharatpurLocalCoords,
          strokeColor: "#06b6d4",
          strokeOpacity: 0.7,
          strokeWeight: 1.2,
          fillColor: "#06b6d4",
          fillOpacity: 0.01,
          map: map,
          visible: switchLocal ? switchLocal.checked : true
        })
      ];

      if (switchProvince) {
        switchProvince.addEventListener("change", (e) => {
          provincePolys.forEach(p => p.setVisible(e.target.checked));
        });
      }
      if (switchDistrict) {
        switchDistrict.addEventListener("change", (e) => {
          districtPolys.forEach(p => p.setVisible(e.target.checked));
        });
      }

      // --- Nepal Hazard Buffer Zones (Nepal-wide Landslide zones + 5km buffers) ---
      const switchNepalBuffers = document.getElementById("switch-nepal-buffers");
      let nepalBuffersLoaded = false;
      const nepalBufferPolys = [];

      function toggleNepalBuffers(visible) {
        if (visible && !nepalBuffersLoaded) {
          fetch("/api/landslide-zones/")
            .then(res => res.json())
            .then(data => {
              const zones = data.hazard_zones || [];
              zones.forEach(hz => {
                if (hz.geometry && hz.geometry.coordinates) {
                  // 1. Draw Landslide Zone
                  const polygonCoords = hz.geometry.coordinates[0].map(coord => ({
                    lat: coord[1],
                    lng: coord[0]
                  }));
                  
                  const polygon = new google.maps.Polygon({
                    paths: polygonCoords,
                    strokeColor: "#ef4444",
                    strokeOpacity: 0.8,
                    strokeWeight: 1.5,
                    fillColor: "#ef4444",
                    fillOpacity: 0.25,
                    map: map,
                    visible: true
                  });
                  
                  const infowindow = new google.maps.InfoWindow({
                    content: `
                      <div class="text-light p-2 small" style="background:#212529; border-radius:6px;">
                        <strong>⚠️ Landslide Zone</strong><br/>
                        Name: ${hz.properties.name}<br/>
                        Highway: ${hz.properties.highway}<br/>
                        Risk: <span class="badge bg-danger">${hz.properties.risk_level}</span>
                      </div>`
                  });
                  polygon.addListener("click", (evt) => {
                    infowindow.setPosition(evt.latLng);
                    infowindow.open(map);
                  });

                  nepalBufferPolys.push(polygon);

                  // 2. Draw 5km Buffer
                  if (typeof turf !== 'undefined') {
                    try {
                      const buffered = turf.buffer(hz, 5, { units: 'kilometers' });
                      const bufferCoords = buffered.geometry.coordinates[0].map(coord => ({
                        lat: coord[1],
                        lng: coord[0]
                      }));

                      const bufferPolygon = new google.maps.Polygon({
                        paths: bufferCoords,
                        strokeColor: "#f59e0b",
                        strokeOpacity: 0.4,
                        strokeWeight: 1,
                        fillColor: "#f59e0b",
                        fillOpacity: 0.08,
                        map: map,
                        visible: true,
                        clickable: false
                      });
                      nepalBufferPolys.push(bufferPolygon);
                    } catch(err) {
                      console.warn("Turf buffer failed for landslide zone", err);
                    }
                  }
                }
              });
              nepalBuffersLoaded = true;
            });
        } else {
          nepalBufferPolys.forEach(p => p.setVisible(visible));
        }
      }

      if (switchNepalBuffers) {
        if (switchNepalBuffers.checked) {
          toggleNepalBuffers(true);
        }
        switchNepalBuffers.addEventListener("change", (e) => {
          toggleNepalBuffers(e.target.checked);
        });
      }

      const bounds = new google.maps.LatLngBounds();
      const markers = [];
      const overlays = {
        route: [],
        hazards: [],
        incidents: []
      };

      // 1. Origin Marker
      if (originPoint) {
        const originLatLng = { lat: originPoint.lat, lng: originPoint.lon };
        const marker = new google.maps.Marker({
          position: originLatLng,
          map: map,
          title: "Origin",
          label: "A",
        });
        const infowindow = new google.maps.InfoWindow({
          content: `<strong>Origin</strong><br/>${origin && origin.name ? origin.name : "Starting point"}`
        });
        marker.addListener("click", () => infowindow.open(map, marker));
        markers.push(marker);
        bounds.extend(originLatLng);
      }

      // 2. Destination Marker
      if (destinationPoint) {
        const destLatLng = { lat: destinationPoint.lat, lng: destinationPoint.lon };
        const marker = new google.maps.Marker({
          position: destLatLng,
          map: map,
          title: "Destination",
          label: "B",
        });
        const infowindow = new google.maps.InfoWindow({
          content: `<strong>Destination</strong><br/>${destination && destination.name ? destination.name : "Arrival point"}`
        });
        marker.addListener("click", () => infowindow.open(map, marker));
        markers.push(marker);
        bounds.extend(destLatLng);
      }

      // 3. Draw Route
      function drawStraightLineRoute() {
        if (routeGeoJSON && routeGeoJSON.route) {
          const routeCoords = routeGeoJSON.route.coordinates || routeGeoJSON.route.geometry?.coordinates;
          if (routeCoords && routeCoords.length) {
            const path = routeCoords.map(coord => ({ lat: coord[1], lng: coord[0] }));
            const polyline = new google.maps.Polyline({
              path: path,
              geodesic: true,
              strokeColor: "#185FA5",
              strokeOpacity: 0.9,
              strokeWeight: 4,
            });
            polyline.setMap(map);
            overlays.route.push(polyline);
            path.forEach(pt => bounds.extend(pt));
            map.roadCoordinates = routeCoords;
            mapShell.roadCoordinates = routeCoords;
          }
        }
      }

      if (originPoint && destinationPoint) {
        const cacheKey = `route_cache_${originPoint.lat.toFixed(4)}_${originPoint.lon.toFixed(4)}_${destinationPoint.lat.toFixed(4)}_${destinationPoint.lon.toFixed(4)}`;
        const cachedRoute = localStorage.getItem(cacheKey);

        if (cachedRoute) {
          try {
            const data = JSON.parse(cachedRoute);
            const roadCoords = data.roadCoords;
            const distanceText = data.distance;
            const durationText = data.duration;

            const path = roadCoords.map(coord => ({ lat: coord[1], lng: coord[0] }));
            const polyline = new google.maps.Polyline({
              path: path,
              strokeColor: "#185FA5",
              strokeOpacity: 0.9,
              strokeWeight: 5,
            });
            polyline.setMap(map);
            overlays.route.push(polyline);
            path.forEach(pt => bounds.extend(pt));
            map.roadCoordinates = roadCoords;
            mapShell.roadCoordinates = roadCoords;

            // Adjust bounds to show entire path
            map.fitBounds(bounds);

            // Update UI values immediately
            setTimeout(() => {
              if (window.YatraNepalPlanner && window.YatraNepalPlanner.updateRouteMetadata) {
                window.YatraNepalPlanner.updateRouteMetadata(distanceText, durationText);
              }
            }, 100);

            console.log("Directions retrieved from local cache: " + cacheKey);
            return;
          } catch (e) {
            console.warn("Cached route parse failed, querying Directions Service.", e);
          }
        }

        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
          map: map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#185FA5",
            strokeOpacity: 0.9,
            strokeWeight: 5
          }
        });

        const request = {
          origin: new google.maps.LatLng(originPoint.lat, originPoint.lon),
          destination: new google.maps.LatLng(destinationPoint.lat, destinationPoint.lon),
          travelMode: google.maps.TravelMode.DRIVING
        };

        directionsService.route(request, (result, status) => {
          if (status === google.maps.DirectionsStatus.OK) {
            directionsRenderer.setDirections(result);
            overlays.route.push(directionsRenderer);
            
            const routeLeg = result.routes[0].legs[0];
            const distanceText = routeLeg.distance.text;
            const durationText = routeLeg.duration.text;

            const roadCoords = [];
            routeLeg.steps.forEach(step => {
              step.path.forEach(latLng => {
                roadCoords.push([latLng.lng(), latLng.lat()]);
              });
            });
            map.roadCoordinates = roadCoords;
            mapShell.roadCoordinates = roadCoords;

            // Cache the route
            try {
              localStorage.setItem(cacheKey, JSON.stringify({
                roadCoords: roadCoords,
                distance: distanceText,
                duration: durationText
              }));
            } catch (err) {
              console.warn("Failed to write route to localStorage", err);
            }

            // Update UI values
            if (window.YatraNepalPlanner && window.YatraNepalPlanner.updateRouteMetadata) {
              window.YatraNepalPlanner.updateRouteMetadata(distanceText, durationText);
            }
          } else {
            console.warn("Directions service failed: " + status + ". Falling back to straight line.");
            drawStraightLineRoute();
          }
        });
      } else {
        drawStraightLineRoute();
      }

      // 4. Draw Hazard Zones
      const allHazards = [...(hazardZones || []), ...(routeGeoJSON?.hazard_zones || [])];
      if (allHazards.length) {
        allHazards.forEach(feature => {
          if (feature && feature.geometry && feature.geometry.coordinates) {
            const coords = feature.geometry.coordinates[0];
            if (Array.isArray(coords)) {
              const polygonCoords = coords.map(coord => ({ lat: coord[1], lng: coord[0] }));
              const polygon = new google.maps.Polygon({
                paths: polygonCoords,
                strokeColor: "#A32D2D",
                strokeOpacity: 0.8,
                strokeWeight: 1.5,
                fillColor: "#E24B4A",
                fillOpacity: 0.25,
              });
              polygon.setMap(map);
              overlays.hazards.push(polygon);

              const props = feature.properties || {};
              const infowindow = new google.maps.InfoWindow({
                content: `<strong>${props.name || "Landslide zone"}</strong><br/>Risk Level: ${props.risk_level || "unknown"}`
              });
              polygon.addListener("click", (event) => {
                infowindow.setPosition(event.latLng);
                infowindow.open(map);
              });
            }
          }
        });
      }

      // Fit Bounds
      if (originPoint || destinationPoint) {
        map.fitBounds(bounds);
      }

      // 5. BIPAD Alerts (Calamities & Road Block Markers)
      const warningSvg = {
        path: "M12 2L2 22h20L12 2zm1 14h-2v-2h2v2zm0-4h-2V8h2v4z",
        fillColor: "#d97706",
        fillOpacity: 0.9,
        strokeColor: "#ffffff",
        strokeWeight: 1.5,
        scale: 1.3,
        anchor: new google.maps.Point(12, 12),
      };

      const blockSvg = {
        path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z",
        fillColor: "#dc2626",
        fillOpacity: 1.0,
        strokeColor: "#ffffff",
        strokeWeight: 1.5,
        scale: 1.3,
        anchor: new google.maps.Point(12, 12),
      };

      fetchBipad(destination && destination.district)
        .then(incidents => {
          incidents.forEach(incident => {
            const loc = normalizePoint(incident.location);
            if (!loc) return;
            const latlng = { lat: loc.lat, lng: loc.lon };
            
            const isBlock = (incident.description || "").toLowerCase().includes("block") || 
                            (incident.description || "").toLowerCase().includes("closed") || 
                            (incident.description || "").toLowerCase().includes("closure") ||
                            (incident.incident_type || "").toLowerCase().includes("block");
            
            const icon = isBlock ? blockSvg : warningSvg;

            const marker = new google.maps.Marker({
              position: latlng,
              map: map,
              icon: icon,
              title: incident.incident_type,
            });
            overlays.incidents.push(marker);

            const blockHeader = isBlock 
              ? `<div style="color:#dc2626; font-weight:bold; font-size:1.1rem; margin-bottom:6px; display:flex; align-items:center; gap:6px;">⛔ ROAD BLOCKED ALERT</div>`
              : `<div style="color:#d97706; font-weight:bold; font-size:1.1rem; margin-bottom:6px; display:flex; align-items:center; gap:6px;">⚠️ CALAMITY WARNING</div>`;

            const infowindow = new google.maps.InfoWindow({
              content: `
                <div style="font-family: 'Manrope', sans-serif; max-width:280px; padding:6px; line-height:1.4;">
                  ${blockHeader}
                  <div style="font-size:0.95rem; margin-bottom:6px;"><strong>Type:</strong> ${incident.incident_type} (${incident.severity})</div>
                  <div style="font-size:0.9rem; color:#444441; margin-bottom:8px; background:#f9fafb; padding:6px; border-radius:6px; border:1px solid #e5e7eb;">${incident.description || "No description available."}</div>
                  <div style="display:flex; justify-content:space-between; font-size:0.85rem; border-top:1px solid #e5e7eb; padding-top:6px; color:#444441;">
                    <span>💀 Deaths: ${incident.deaths ?? 0}</span>
                    <span>🤕 Injured: ${incident.injured ?? 0}</span>
                  </div>
                  <div style="font-size:0.8rem; color:#888882; margin-top:6px; text-align:right;">Date: ${new Date(incident.incident_date).toLocaleDateString()}</div>
                </div>
              `
            });

            marker.addListener("click", () => {
              infowindow.open(map, marker);
            });
          });
        })
        .catch(err => console.error("Error loading BIPAD alerts:", err));

      // 6. Custom Layers Control UI
      const controlDiv = document.createElement("div");
      controlDiv.className = "custom-map-layer-control";

      const layersConfig = [
        { id: "chk-route", label: "Show Route", key: "route" },
        { id: "chk-hazards", label: "Hazard Zones", key: "hazards" },
        { id: "chk-alerts", label: "BIPAD Alerts", key: "incidents" }
      ];

      layersConfig.forEach(cfg => {
        const lbl = document.createElement("label");
        lbl.innerHTML = `<input type="checkbox" id="${cfg.id}" checked> ${cfg.label}`;
        lbl.querySelector("input").addEventListener("change", (e) => {
          overlays[cfg.key].forEach(item => item.setMap(e.target.checked ? map : null));
        });
        controlDiv.appendChild(lbl);
      });

      const satelliteLabel = document.createElement("label");
      satelliteLabel.innerHTML = `<input type="checkbox" id="chk-satellite"> Satellite Map`;
      satelliteLabel.querySelector("input").addEventListener("change", (e) => {
        map.setMapTypeId(e.target.checked ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.ROADMAP);
      });
      controlDiv.appendChild(satelliteLabel);

      map.controls[google.maps.ControlPosition.TOP_RIGHT].push(controlDiv);

      map.flyToBounds = (coordsList) => {
        const gBounds = new google.maps.LatLngBounds();
        coordsList.forEach(coord => gBounds.extend({ lat: coord[1], lng: coord[0] }));
        map.fitBounds(gBounds);
      };

      // Set the real map instance
      mapShell.realMap = map;
      mapShell.isLoaded = true;

      // Run pending bounds adjustments
      if (mapShell.pendingFlyTo) {
        mapShell.flyToBounds(mapShell.pendingFlyTo);
      }
      if (mapShell.pendingPanTo) {
        map.panTo(mapShell.pendingPanTo);
      }
      if (mapShell.pendingZoom) {
        map.setZoom(mapShell.pendingZoom);
      }

    }).catch(err => {
      container.innerHTML = `<div style="padding:16px; color:#A32D2D; background:#FCEBEB; height:100%; display:flex; align-items:center; justify-content:center;">Failed to load map: ${err.message}</div>`;
    });

    return mapShell;
  }

  window.initMap = initMap;
})();
