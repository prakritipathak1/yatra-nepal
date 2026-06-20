(function () {
  const state = {
    destinations: [],
    selectedDestination: null,
    origin: null,
    originQuery: "Kathmandu",
    originMatches: [],
    departureDate: "",
    returnDate: "",
    weather: null,
    risk: null,
    route: null,
    routeMap: null,
    rating: null,
    trip: null,
    currentStep: 1,
  };

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString("en-NP", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function getDestinationPoint(destination) {
    const location = destination && destination.location ? destination.location : {};
    if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
      return { lat: Number(location.coordinates[1]), lon: Number(location.coordinates[0]) };
    }
    if (typeof location.lat === "number" && typeof location.lon === "number") {
      return { lat: location.lat, lon: location.lon };
    }
    if (typeof location.y === "number" && typeof location.x === "number") {
      return { lat: location.y, lon: location.x };
    }
    return { lat: 0, lon: 0 };
  }

  function getToday() {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - offset).toISOString().slice(0, 10);
  }

  function applyDateConstraints() {
    const departureInput = document.getElementById("departure-date");
    const returnInput = document.getElementById("return-date");
    if (!departureInput || !returnInput) {
      return;
    }
    const today = getToday();
    departureInput.min = today;
    if (departureInput.value && departureInput.value < today) {
      departureInput.value = today;
      state.departureDate = today;
    }
    // Calculate minimum return date (at least 1 day after departure)
    const departure = new Date(departureInput.value || today);
    const minReturn = new Date(departure);
    minReturn.setDate(minReturn.getDate() + 1);
    const minReturnStr = minReturn.toISOString().slice(0, 10);
    returnInput.min = minReturnStr;
    if (returnInput.value && returnInput.value < minReturnStr) {
      returnInput.value = minReturnStr;
      state.returnDate = minReturnStr;
    }
  }

  function renderStep(step) {
    state.currentStep = step;
    $all(".wizard-step").forEach((item) => {
      const index = Number(item.dataset.step);
      item.classList.toggle("active", index === step);
      item.classList.toggle("complete", index < step);
    });
    $all("[data-panel]").forEach((panel) => {
      panel.classList.toggle("active", Number(panel.dataset.panel) === step);
    });
  }

  function updateStepIndicator() {
    const status = $("#planner-status");
    if (status) {
      status.textContent = `Step ${state.currentStep} of 5`;
    }
  }

  function destinationCard(destination) {
    const isSelected = state.selectedDestination && state.selectedDestination.id === destination.id;
    const borderClass = isSelected ? "border-primary border-2 shadow bg-primary bg-opacity-10" : "border-secondary border-opacity-25 bg-dark bg-opacity-25";
    const selectedBadge = isSelected ? `<span class="badge bg-primary position-absolute top-0 end-0 m-2">✓ Selected</span>` : "";
    
    return `
      <div class="col">
        <div class="card h-100 position-relative transition-all ${borderClass} destination-select-card" data-destination-id="${destination.id}" style="cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;">
          ${selectedBadge}
          <div class="card-body p-3">
            <span class="badge bg-primary-subtle text-primary rounded-pill mb-2 px-2.5 py-1 fw-semibold">${destination.region}</span>
            <h4 class="h5 fw-bold text-light mb-1 mt-1" style="font-family:'Outfit', sans-serif;">${destination.name}</h4>
            <p class="text-secondary small mb-3">${destination.activity_type} · ${destination.difficulty}</p>
            <div class="d-flex justify-content-between text-secondary small border-top border-secondary border-opacity-10 pt-2 mt-auto">
              <span>📍 ${destination.distance_from_ktm_km} km from KTM</span>
              <span>Altitude: ${destination.altitude_m}m</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderDestinationGrid() {
    const grid = $("#destination-grid");
    if (!grid) {
      return;
    }
    grid.innerHTML = state.destinations.map(destinationCard).join("");
    $all("[data-destination-id]", grid).forEach((button) => {
      button.addEventListener("click", () => {
        const destination = state.destinations.find((item) => item.id === Number(button.dataset.destinationId));
        if (destination) {
          state.selectedDestination = destination;
          renderDestinationGrid();
          renderSummary();
          validateStep1();
        }
      });

      button.addEventListener("dblclick", () => {
        const destination = state.destinations.find((item) => item.id === Number(button.dataset.destinationId));
        if (destination) {
          state.selectedDestination = destination;
          renderDestinationGrid();
          renderSummary();
          validateStep1();

          const nextBtn = $("#step1-next");
          if (nextBtn && !nextBtn.disabled) {
            nextBtn.click();
          }
        }
      });
    });
  }

  function renderOriginAutocomplete(results) {
    const list = $("#origin-results");
    if (!list) {
      return;
    }
    list.innerHTML = results
      .map(
        (item) => `
      <button type="button" class="autocomplete-item" data-lat="${item.lat}" data-lon="${item.lon}" data-label="${item.display_name}">
        ${item.display_name}
      </button>
    `
      )
      .join("");
    $all("button", list).forEach((button) => {
      button.addEventListener("click", () => {
        state.origin = {
          name: button.dataset.label,
          lat: Number(button.dataset.lat),
          lon: Number(button.dataset.lon),
        };
        $("#origin-city").value = button.dataset.label;
        list.innerHTML = "";
        validateStep2();
      });
    });
  }

  async function lookupOrigin(query) {
    try {
      const results = await window.YatraNepalAPI.geocode(query);
      state.originMatches = results;
      renderOriginAutocomplete(results);
    } catch (error) {
      state.originMatches = [];
      renderOriginAutocomplete([]);
    }
  }

  function validateStep1() {
    const next = $("#step1-next");
    if (next) {
      next.disabled = !state.selectedDestination;
    }
  }

  function validateStep2() {
    const next = $("#step2-next");
    const departure = $("#departure-date").value;
    const returnDate = $("#return-date").value;
    const validDateRange = departure && returnDate && new Date(returnDate) >= new Date(departure);
    const validOrigin = Boolean(state.origin && Number.isFinite(state.origin.lat) && Number.isFinite(state.origin.lon));
    if (next) {
      next.disabled = !(validDateRange && validOrigin);
    }
  }

  function validateStep3() {
    const next = $("#step3-next");
    if (next) {
      next.disabled = !state.route || !state.weather || !state.rating;
    }
  }

  function buildTripPayload() {
    return {
      destination_id: state.selectedDestination.id,
      origin_city: state.origin.name,
      origin_lat: state.origin.lat,
      origin_lon: state.origin.lon,
      departure_date: state.departureDate,
      return_date: state.returnDate,
    };
  }

  async function createTripDraft() {
    if (!state.selectedDestination || !state.origin || !state.departureDate || !state.returnDate) {
      return null;
    }
    state.trip = {
      id: `local-${Date.now()}`,
      local: true,
      ...buildTripPayload(),
    };
    return state.trip;
  }

  function renderSummary() {
    const summary = $("#trip-summary");
    const summaryConfirm = $("#trip-summary-confirm");
    
    if (!state.selectedDestination) {
      const emptyHtml = "<p>Select a destination to see your summary.</p>";
      if (summary) summary.innerHTML = emptyHtml;
      if (summaryConfirm) summaryConfirm.innerHTML = emptyHtml;
      return;
    }

    const htmlContent = `
      <div class="summary-card">
        <h3>${state.selectedDestination.name}</h3>
        <p>${state.selectedDestination.region} · ${state.selectedDestination.district}</p>
        <dl>
          <div><dt>Origin</dt><dd>${state.origin ? state.origin.name : "Not selected"}</dd></div>
          <div><dt>Dates</dt><dd>${state.departureDate ? formatDate(state.departureDate) : "--"} to ${state.returnDate ? formatDate(state.returnDate) : "--"}</dd></div>
          <div><dt>Permit</dt><dd>${state.selectedDestination.permit_required || "None"}</dd></div>
          <div><dt>Activity</dt><dd>${state.selectedDestination.activity_type}</dd></div>
        </dl>
      </div>
    `;

    if (summary) summary.innerHTML = htmlContent;
    if (summaryConfirm) summaryConfirm.innerHTML = htmlContent;
  }

  function getWeatherIcon(forecast) {
    const code = Number(forecast.weather_code);
    const label = (forecast.weather_label || "").toLowerCase();
    if (code === 800 || label.includes("sunny") || label.includes("clear")) return "☀️";
    if ([801, 802, 803, 804].includes(code) || label.includes("cloud")) return "⛅";
    if (code >= 200 && code < 300) return "⛈️";
    if ((code >= 300 && code < 600) || label.includes("rain")) return "🌧️";
    if ((code >= 600 && code < 700) || label.includes("snow")) return "❄️";
    if ((code >= 700 && code < 800) || label.includes("fog") || label.includes("mist")) return "🌫️";
    return "🌤️";
  }

  function buildLocalRating() {
    // 1. Weather percentage (based on live forecast probability of rain and wind speed)
    const forecasts = state.weather?.forecasts || [];
    let weatherPercent = 85;
    if (forecasts.length) {
      const avgPrecip = forecasts.reduce((sum, f) => sum + (f.precipitation_probability ?? 0), 0) / forecasts.length;
      const avgWind = forecasts.reduce((sum, f) => sum + (f.wind_speed_kmh ?? 0), 0) / forecasts.length;
      weatherPercent = Math.max(10, Math.min(100, 100 - (avgPrecip * 0.6) - (avgWind * 0.5)));
    }

    // 2. Road Safety percentage (based on active hazard zones along route)
    let roadSafetyPercent = 95;
    const routeHazardsCount = state.route?.hazard_count ?? state.route?.hazard_zones?.length ?? 0;
    if (routeHazardsCount > 0) {
      roadSafetyPercent = Math.max(20, 95 - (routeHazardsCount * 15));
    }

    // 3. Geographic Disaster Risk percentage (based on landslide/monsoon probability percent)
    const risks = state.risk?.risks || [];
    let geoRiskPercent = 90;
    if (risks.length) {
      const avgProb = risks.reduce((sum, r) => sum + (r.probability_percent ?? 0), 0) / risks.length;
      geoRiskPercent = Math.max(10, 100 - avgProb);
    }

    const overallPercent = Math.round((weatherPercent * 0.4) + (roadSafetyPercent * 0.3) + (geoRiskPercent * 0.3));

    return {
      overall_score: overallPercent / 10,
      overall_percent: overallPercent,
      weather_score: weatherPercent / 10,
      route_safety_score: roadSafetyPercent / 10,
      disaster_risk_score: geoRiskPercent / 10,
      activity_fit_score: 8.5,
      infrastructure_score: 7.5,
      crowd_level_score: 8.0,
      source: "Live Public Geographic Data"
    };
  }

  function renderWeather() {
    const container = $("#weather-grid");
    if (!container || !state.weather || !Array.isArray(state.weather.forecasts)) {
      return;
    }

    const getForecastDate = (forecast) => forecast.forecast_date || forecast.date || "";
    const bestDay = state.weather.forecasts.reduce((best, current) => {
      if (!best) return current;
      const currentScore = current.is_sailing_suitable ? 2 : 0;
      const bestScore = best.is_sailing_suitable ? 2 : 0;
      return currentScore > bestScore || (currentScore === bestScore && current.precipitation_probability < best.precipitation_probability) ? current : best;
    }, null);

    container.innerHTML = state.weather.forecasts
      .map((forecast, index) => {
        const forecastDate = getForecastDate(forecast);
        const isBest = bestDay && getForecastDate(bestDay) === forecastDate;
        const icon = getWeatherIcon(forecast);
        const tempScore = Math.max(10, Math.min(100, ((forecast.temp_max_c ?? 20) + 10) * 2.5));
        const colorClass = forecast.temp_max_c >= 25 ? "hot" : forecast.temp_max_c <= 14 ? "cool" : "mild";
        return `
        <article class="forecast-day ${isBest ? "best" : ""} ${colorClass}" style="animation-delay: ${index * 60}ms;">
          <div class="forecast-top">
            <span class="forecast-icon">${icon}</span>
            <div>
              <strong>${forecastDate ? formatDate(forecastDate) : "Unknown"}</strong>
              <span class="forecast-label">${forecast.weather_label || "No data"}</span>
            </div>
          </div>
          <div class="forecast-temp">
            <strong>${forecast.temp_min_c?.toFixed(1) ?? "--"}°</strong>
            <span>to</span>
            <strong>${forecast.temp_max_c?.toFixed(1) ?? "--"}°C</strong>
          </div>
          <div class="temp-meter"><span style="width:${tempScore}%"></span></div>
          <div class="forecast-stats">
            <span>Rain ${forecast.precipitation_probability ?? "--"}%</span>
            <span>Wind ${forecast.wind_speed_kmh?.toFixed(1) ?? "--"} km/h</span>
          </div>
          <div class="forecast-badge ${forecast.is_sailing_suitable ? "safe" : "caution"}">${forecast.is_sailing_suitable ? "Best day" : "Use caution"}</div>
        </article>
      `;
      })
      .join("");
  }

  function getRiskIcon(item) {
    const severity = (item.severity || "").toLowerCase();
    if (severity.includes("high") || severity.includes("severe")) return "⚠️";
    if (severity.includes("moderate")) return "⚡";
    if (severity.includes("low") || severity.includes("minor")) return "ℹ️";
    return "❗";
  }

  function renderRisk() {
    const bars = $("#risk-bars");
    const alerts = $("#risk-alerts");
    if (bars && state.risk) {
      bars.innerHTML = `<div class="risk-grid">` + state.risk.risks
        .map((item, index) => {
          const icon = getRiskIcon(item);
          const intensity = Math.min(100, item.probability_percent || 25);
          const severityClass = (item.severity || "").toLowerCase().replace(/\s+/g, "-");
          return `
            <div class="risk-card risk-${severityClass}" style="animation-delay: ${index * 80}ms;">
              <div class="risk-header">
                <span class="risk-icon">${icon}</span>
                <strong>${item.risk_type.replace(/_/g, " ")}</strong>
              </div>
              <div class="risk-meta">
                <span class="risk-probability">${item.probability_percent}%</span>
                <span class="risk-severity">${item.severity}</span>
              </div>
              <div class="risk-bar-container">
                <div class="risk-bar"><span style="width:${intensity}%"></span></div>
              </div>
              <p class="risk-notes">${item.notes || item.source || "No additional details."}</p>
            </div>
          `;
        })
        .join("") + `</div>`;
    } else if (bars) {
      bars.innerHTML = `<div class="risk-card"><p>No risk details available for this destination.</p></div>`;
    }
    if (alerts) {
      const incidents = state.bipadAlerts || [];
      if (incidents.length === 0) {
        alerts.innerHTML = `
          <div class="card bg-dark border-secondary border-opacity-25 p-3 rounded-3 mt-4">
            <h4 class="h6 fw-bold text-light mb-2">🚨 Live BIPAD Incident Alerts (${state.selectedDestination?.district || "Local District"})</h4>
            <p class="text-secondary small mb-0">No active roads, damage, or block alerts reported on the BIPAD portal for this district in the last 30 days.</p>
          </div>`;
      } else {
        const incidentsHtml = incidents.map(inc => {
          const isBlock = (inc.description || "").toLowerCase().includes("block") || 
                          (inc.description || "").toLowerCase().includes("closed") || 
                          (inc.description || "").toLowerCase().includes("closure") ||
                          (inc.incident_type || "").toLowerCase().includes("block");
          
          const alertColor = isBlock ? "danger" : "warning";
          const alertBadge = isBlock ? "⛔ Road Blocked" : "⚠️ Calamity";
          const dateStr = new Date(inc.incident_date).toLocaleDateString("en-NP", {
            month: "short",
            day: "numeric",
            year: "numeric"
          });

          return `
            <div class="card bg-dark border-${alertColor} border-opacity-25 rounded-3 mb-2">
              <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <span class="badge bg-${alertColor} text-light me-2">${alertBadge}</span>
                    <strong class="text-light">${inc.incident_type}</strong>
                  </div>
                  <small class="text-secondary">${dateStr}</small>
                </div>
                <p class="text-secondary small mb-2">${inc.description || "No description provided."}</p>
                <div class="d-flex gap-3 text-secondary small border-top border-secondary border-opacity-10 pt-2">
                  <span>💀 Deaths: <strong>${inc.deaths || 0}</strong></span>
                  <span>🤕 Injured: <strong>${inc.injured || 0}</strong></span>
                  <span>Severity: <span class="badge bg-secondary text-capitalize py-0.5 px-1.5">${inc.severity}</span></span>
                </div>
              </div>
            </div>
          `;
        }).join("");

        alerts.innerHTML = `
          <div class="mt-4">
            <h4 class="h5 fw-bold text-light mb-3" style="font-family:'DM Serif Display',Georgia,serif;">🚨 Live BIPAD Portal Alerts (${state.selectedDestination?.district || "Local District"})</h4>
            <div style="max-height: 400px; overflow-y: auto; padding-right: 5px;">
              ${incidentsHtml}
            </div>
          </div>
        `;
      }
    }
  }

  function renderRating() {
    const ring = $("#rating-ring");
    const bars = $("#rating-bars");
    if (!state.rating) {
      if (bars) bars.innerHTML = "<p>Rating preview is not available yet.</p>";
      return;
    }

    const percent = state.rating.overall_percent || Math.round(state.rating.overall_score * 10);

    if (ring) {
      ring.style.setProperty("--score", percent);
      
      let color = "#10b981"; // Emerald green
      let label = "Good to go!";
      if (percent < 50) {
        color = "#ef4444"; // Red
        label = "High risk!";
      } else if (percent < 75) {
        color = "#f59e0b"; // Amber
        label = "Caution advised!";
      }
      
      // Adjusted center circle color to match premium dark dashboard theme
      ring.style.setProperty("background", `radial-gradient(circle closest-side, rgba(27, 31, 44, 0.95) 72%, transparent 73%), conic-gradient(${color} calc(var(--score, 0) * 1%), rgba(255, 255, 255, 0.08) 0)`);
      
      ring.innerHTML = `
        <strong class="fs-1 fw-bold" style="color: ${color}; font-family:'Outfit',sans-serif;">${percent}%</strong>
        <span class="text-secondary small mt-1 fw-semibold">${label}</span>
      `;
    }

    if (bars) {
      const items = [
        ["Weather Suitability", state.rating.weather_score * 10, "#3b82f6"],
        ["Route Road Safety", state.rating.route_safety_score * 10, "#a855f7"],
        ["Disaster Risk Profile", state.rating.disaster_risk_score * 10, "#f59e0b"],
        ["Seasonal Activity Fit", state.rating.activity_fit_score * 10, "#10b981"],
        ["Destination Infrastructure", state.rating.infrastructure_score * 10, "#06b6d4"],
      ];

      const barsHtml = items.map(([label, value, progressColor]) => {
        const score = Number(value) || 0;
        return `
          <div class="mb-2">
            <div class="d-flex justify-content-between small mb-1">
              <span class="text-secondary">${label}</span>
              <strong class="text-light">${Math.round(score)}%</strong>
            </div>
            <div class="progress" style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 4px;">
              <div class="progress-bar" role="progressbar" style="width: ${Math.max(0, Math.min(100, score))}%; background-color: ${progressColor}; border-radius: 4px;"></div>
            </div>
          </div>
        `;
      }).join("");

      // Dynamic safety warning recommendation based on rating percentage
      let adviceHtml = "";
      if (percent >= 75) {
        adviceHtml = `
          <div class="alert alert-success border-success border-opacity-25 bg-success bg-opacity-10 text-success p-3 rounded-3 mt-3 small">
            <strong>☀️ Safe Travel Forecast</strong><br/>
            Weather suitability is excellent and no major hazard blockages have been reported on the routes. Ideal conditions for tourism.
          </div>`;
      } else if (percent >= 50) {
        adviceHtml = `
          <div class="alert alert-warning border-warning border-opacity-25 bg-warning bg-opacity-10 text-warning p-3 rounded-3 mt-3 small">
            <strong>⚠️ Route Caution Advised</strong><br/>
            Moderate weather conditions or potential landslide risk segments identified along the transit path. Keep tabs on live weather updates.
          </div>`;
      } else {
        adviceHtml = `
          <div class="alert alert-danger border-danger border-opacity-25 bg-danger bg-opacity-10 text-danger p-3 rounded-3 mt-3 small">
            <strong>🛑 High Risk Advisory</strong><br/>
            Unfavorable weather or active roadblock warnings on the route path. reschedule or inspect alternative routes.
          </div>`;
      }

      bars.innerHTML = `
        <div class="d-flex flex-column h-100">
          <h4 class="h6 fw-bold text-light mb-3">Travel Rating Sub-metrics</h4>
          ${barsHtml}
          ${adviceHtml}
          ${state.rating.source ? `<p class="text-secondary small mt-3 mb-0" style="font-size:0.7rem;">Source: ${state.rating.source}</p>` : ""}
        </div>
      `;
    }
  }

  async function loadWeatherAndRisk() {
    if (!state.selectedDestination || !state.departureDate || !state.returnDate) {
      return;
    }
    const weather = await window.YatraNepalAPI.get(
      `/api/weather/${state.selectedDestination.id}/${state.departureDate}/${state.returnDate}/`
    );
    const risk = await window.YatraNepalAPI.get(`/api/risk/${state.selectedDestination.id}/${new Date(state.departureDate).getMonth() + 1}/`);
    
    let bipadAlerts = [];
    try {
      const bipadResponse = await window.YatraNepalAPI.get(`/api/bipad/alerts/${encodeURIComponent(state.selectedDestination.district)}/`);
      bipadAlerts = bipadResponse.incidents || [];
    } catch(err) {
      console.warn("Failed to fetch BIPAD alerts:", err);
    }
    
    state.weather = weather;
    state.risk = risk;
    state.bipadAlerts = bipadAlerts;
    renderWeather();
    renderRisk();
    validateStep3();
  }

  async function loadRouteAndRating() {
    if (!state.selectedDestination || !state.origin) {
      return;
    }
    const destinationPoint = getDestinationPoint(state.selectedDestination);
    const route = await window.YatraNepalAPI.get(
      `/api/route/${state.origin.lat}/${state.origin.lon}/${destinationPoint.lat}/${destinationPoint.lon}/`
    );
    state.route = route;
    renderRouteMap();
    validateStep3();
  }

  function renderRouteMap() {
    const mapElement = $("#trip-map");
    if (!mapElement || !state.route || !state.selectedDestination || !state.origin) {
      return null;
    }
    if (state.routeMap && typeof state.routeMap.remove === "function") {
      state.routeMap.remove();
      state.routeMap = null;
    }
    mapElement.innerHTML = "";
    mapElement.classList.remove("map-loaded");
    mapElement.classList.add("map-loading");

    const map = initMap("trip-map", state.origin, state.selectedDestination, state.route, state.route.hazard_zones || []);
    state.routeMap = map;
    if (map && typeof map.invalidateSize === "function") {
      requestAnimationFrame(() => {
        map.invalidateSize();
        window.setTimeout(() => map.invalidateSize(), 100);
        window.setTimeout(() => {
          map.invalidateSize();
          mapElement.classList.remove("map-loading");
          mapElement.classList.add("map-loaded");
        }, 300);
      });
    }

    if (state.routeMap && state.routeMap.getBounds && state.route && state.route.route) {
      const coords = state.route.route.coordinates || [];
      if (coords.length) {
        const bounds = L.latLngBounds(coords.map((coord) => [coord[1], coord[0]]));
        state.routeMap.flyToBounds(bounds.pad(0.16), { duration: 1.1, easeLinearity: 0.25 });
      }
    }

    if (document.querySelector('.tabs button.active')?.dataset.tab === 'route') {
      window.setTimeout(() => {
        if (map && typeof map.invalidateSize === "function") {
          map.invalidateSize();
        }
      }, 300);
    }
    return map;
  }

  function refreshRouteMap() {
    if (state.routeMap && typeof state.routeMap.invalidateSize === "function") {
      state.routeMap.invalidateSize();
      window.setTimeout(() => state.routeMap && state.routeMap.invalidateSize(), 80);
      return state.routeMap;
    }
    return renderRouteMap();
  }

  async function computeRatingPreview() {
    state.rating = buildLocalRating();
    renderRating();
    validateStep3();
  }

  async function saveTrip() {
    if (!state.selectedDestination || !state.origin) {
      return;
    }
    if (!state.trip) {
      await createTripDraft();
      await loadWeatherAndRisk();
      await loadRouteAndRating();
      await computeRatingPreview();
    }

    const savedTrip = {
      id: state.trip.id,
      destination: state.selectedDestination,
      origin_location: state.origin,
      departure_date: state.departureDate,
      return_date: state.returnDate,
      status: "Planned",
      travel_rating: state.rating ? state.rating.overall_score.toFixed(1) : "Pending",
      route_geojson: state.route ? state.route.route : null,
      created_at: new Date().toISOString(),
    };

    const savedTrips = JSON.parse(localStorage.getItem("yatranepal_saved_trips") || "[]");
    const existingIndex = savedTrips.findIndex(t => t.id === savedTrip.id);
    if (existingIndex > -1) {
      savedTrips[existingIndex] = savedTrip;
    } else {
      savedTrips.push(savedTrip);
    }
    localStorage.setItem("yatranepal_saved_trips", JSON.stringify(savedTrips));

    localStorage.setItem(`yatranepal_alert_subscription_${state.trip.id}`, JSON.stringify({ trip_id: state.trip.id, subscribed: true }));
    renderStep(5);
    const completion = $("#completion-message");
    if (completion) {
      completion.innerHTML = `<h3>Trip saved</h3><p>Your alert subscription is active for ${state.selectedDestination.name}.</p>`;
    }
  }

  let gisSearchCircle = null;
  let gisBufferPolygon = null;
  let exploreMarkers = [];
  let routeSpotMarkers = [];

  function initGisTools() {
    // 1. Render Initial Attribute Table
    renderAttributeTable(state.destinations);

    // 2. Bind Attribute Filters
    const filterCategory = $("#gis-filter-category");
    const filterDifficulty = $("#gis-filter-difficulty");
    const filterRegion = $("#gis-filter-region");
    const findNearbyBtn = $("#btn-find-nearby");
    const radiusInput = $("#gis-radius");

    const applyFilters = () => {
      let filtered = [...state.destinations];

      const cat = filterCategory.value;
      if (cat) {
        filtered = filtered.filter(d => d.activity_type === cat);
      }
      const diff = filterDifficulty.value;
      if (diff) {
        filtered = filtered.filter(d => d.difficulty === diff);
      }
      const reg = filterRegion.value;
      if (reg) {
        filtered = filtered.filter(d => d.region === reg);
      }

      const radius = parseFloat(radiusInput.value) || 0;
      if (radius > 0 && state.origin) {
        const originLatLng = new google.maps.LatLng(state.origin.lat, state.origin.lon);
        
        if (gisSearchCircle) {
          gisSearchCircle.setMap(null);
        }

        if (state.routeMap && state.routeMap.realMap) {
          gisSearchCircle = new google.maps.Circle({
            strokeColor: "#1D9E75",
            strokeOpacity: 0.8,
            strokeWeight: 1.5,
            fillColor: "#EAF3DE",
            fillOpacity: 0.2,
            map: state.routeMap.realMap,
            center: originLatLng,
            radius: radius,
          });
        }

        filtered = filtered.filter(d => {
          const loc = getDestinationPoint(d);
          const destLatLng = new google.maps.LatLng(loc.lat, loc.lon);
          const dist = google.maps.geometry.spherical.computeDistanceBetween(originLatLng, destLatLng);
          return dist <= radius;
        });
      } else {
        if (gisSearchCircle) {
          gisSearchCircle.setMap(null);
          gisSearchCircle = null;
        }
      }

      renderAttributeTable(filtered);
    };

    findNearbyBtn?.addEventListener("click", applyFilters);
    [filterCategory, filterDifficulty, filterRegion].forEach(el => {
      el?.addEventListener("change", applyFilters);
    });

    // 3. Distance Measurement
    const measureBtn = $("#btn-measure-dist");
    measureBtn?.addEventListener("click", () => {
      if (!state.routeMap) return;
      
      const coords = (state.routeMap && state.routeMap.roadCoordinates) || (state.route && state.route.route && state.route.route.coordinates) || [];
      if (coords.length) {
        let totalDist = 0;
        for (let i = 0; i < coords.length - 1; i++) {
          const p1 = new google.maps.LatLng(coords[i][1], coords[i][0]);
          const p2 = new google.maps.LatLng(coords[i+1][1], coords[i+1][0]);
          totalDist += google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
        }
        $("#dist-result").textContent = `${(totalDist / 1000).toFixed(1)} km`;
        alert(`Driving road route distance: ${(totalDist / 1000).toFixed(1)} km`);
      } else {
        alert("Please plan a route (Step 2) to calculate distance!");
      }
    });

    // 4. Buffer Analysis (Turf.js)
    const bufferBtn = $("#btn-route-buffer");
    bufferBtn?.addEventListener("click", () => {
      if (!state.routeMap || !state.route || !state.route.route) {
        alert("Please plan a route first to generate a buffer!");
        return;
      }

      if (gisBufferPolygon) {
        gisBufferPolygon.setMap(null);
      }

      const coords = (state.routeMap && state.routeMap.roadCoordinates) || (state.route && state.route.route && state.route.route.coordinates) || [];
      if (!coords.length) {
        alert("Wait a second, road route coordinates are still loading...");
        return;
      }

      const turfLine = turf.lineString(coords);
      const turfBuffer = turf.buffer(turfLine, 5, { units: 'kilometers' });
      const bufferCoords = turfBuffer.geometry.coordinates[0].map(coord => ({
        lat: coord[1],
        lng: coord[0]
      }));

      if (state.routeMap && state.routeMap.realMap) {
        gisBufferPolygon = new google.maps.Polygon({
          paths: bufferCoords,
          strokeColor: "#BA7517",
          strokeOpacity: 0.8,
          strokeWeight: 1.5,
          fillColor: "#FAEEDA",
          fillOpacity: 0.35,
          map: state.routeMap.realMap
        });
      }

      let intersectCount = 0;
      const hazards = state.route.hazard_zones || [];
      
      hazards.forEach(hazard => {
        if (hazard && hazard.geometry) {
          try {
            const intersect = turf.booleanIntersects(hazard, turfBuffer);
            if (intersect) {
              intersectCount++;
            }
          } catch(e) {
            try {
              const centroid = turf.centroid(hazard);
              const inside = turf.booleanPointInPolygon(centroid, turfBuffer);
              if (inside) intersectCount++;
            } catch(err) {}
          }
        }
      });

      $("#buffer-status").textContent = `${intersectCount} zone(s)`;
      alert(`Turf.js 5km buffer generated!\nDetected ${intersectCount} landslide hazard zone(s) within the buffer.`);
    });

    // 5. Nearest Destination Finder
    const nearestBtn = $("#btn-nearest-dest");
    nearestBtn?.addEventListener("click", () => {
      if (!state.origin || !state.destinations.length) {
        alert("Select origin and load destinations first!");
        return;
      }

      const originLatLng = new google.maps.LatLng(state.origin.lat, state.origin.lon);
      let closest = null;
      let minDistance = Infinity;

      state.destinations.forEach(dest => {
        const destLoc = getDestinationPoint(dest);
        const destLatLng = new google.maps.LatLng(destLoc.lat, destLoc.lon);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(originLatLng, destLatLng);
        
        if (distance < minDistance) {
          minDistance = distance;
          closest = dest;
        }
      });

      if (closest) {
        $("#nearest-result").textContent = `${closest.name} (${(minDistance / 1000).toFixed(1)} km)`;
        if (state.routeMap && state.routeMap.realMap) {
          const loc = getDestinationPoint(closest);
          const latLng = new google.maps.LatLng(loc.lat, loc.lon);
          state.routeMap.panTo({ lat: loc.lat, lng: loc.lon });
          state.routeMap.setZoom(12);

          if (window.nearestDestMarker) {
            window.nearestDestMarker.setMap(null);
          }
          if (window.nearestDestLine) {
            window.nearestDestLine.setMap(null);
          }

          window.nearestDestMarker = new google.maps.Marker({
            position: latLng,
            map: state.routeMap.realMap,
            title: "Nearest: " + closest.name,
            icon: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
            animation: google.maps.Animation.BOUNCE,
            zIndex: 9999
          });

          window.nearestDestLine = new google.maps.Polyline({
            path: [originLatLng, latLng],
            geodesic: true,
            strokeColor: "#22c55e",
            strokeOpacity: 1.0,
            strokeWeight: 3,
            map: state.routeMap.realMap
          });

          setTimeout(() => {
             if (window.nearestDestMarker) window.nearestDestMarker.setAnimation(null);
          }, 4000);
        }
      }
    });

    // 6. Explore Nearby Places (Places API) - Local Tourism Finder
    const placesSearchInput = $("#places-search-input");
    const btnPlacesSearch = $("#btn-places-search");

    const performPlacesSearch = () => {
      if (!state.routeMap || !state.routeMap.realMap) {
        alert("Please ensure the map is loaded first!");
        return;
      }

      const searchVal = placesSearchInput.value.trim();
      const map = state.routeMap.realMap;

      if (!searchVal) {
        // Fallback to active/selected destination location
        if (state.selectedDestination) {
          const loc = getDestinationPoint(state.selectedDestination);
          const latLng = new google.maps.LatLng(loc.lat, loc.lon);
          map.setCenter(latLng);
          map.setZoom(14);
          executeNearbySearch(latLng);
        } else {
          alert("Please enter a place to search or select a destination first!");
        }
        return;
      }

      // Use Geocoder to resolve the text search value
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: searchVal + ", Nepal" }, (results, status) => {
        if (status === "OK" && results[0]) {
          const latLng = results[0].geometry.location;
          map.setCenter(latLng);
          map.setZoom(14);
          executeNearbySearch(latLng);
        } else {
          alert("Could not find the location: " + searchVal);
        }
      });
    };

    const executeNearbySearch = (location) => {
      const typesToSearch = [];
      if (document.getElementById("find-lodging")?.checked) typesToSearch.push({ type: "lodging", label: "Hotel", char: "🏨", color: "#185FA5" });
      if (document.getElementById("find-restaurant")?.checked) typesToSearch.push({ type: "restaurant", label: "Restaurant", char: "🍴", color: "#BA7517" });
      if (document.getElementById("find-attraction")?.checked) typesToSearch.push({ type: "tourist_attraction", label: "Attraction", char: "🎡", color: "#10b981" });

      if (typesToSearch.length === 0) {
        alert("Please select at least one tourism category to find (Hotels, Restaurants, or Attractions)!");
        return;
      }

      // Clear previous explore markers
      exploreMarkers.forEach(m => m.setMap(null));
      exploreMarkers = [];

      const list = $("#places-search-results");
      if (list) {
        list.innerHTML = `<div class="text-center text-primary py-2 small">Searching tourism spots...</div>`;
      }

      const service = new google.maps.places.PlacesService(state.routeMap.realMap);
      const promises = typesToSearch.map(cfg => {
        return new Promise((resolve) => {
          const req = {
            location: location,
            radius: 5000,
            type: cfg.type
          };
          service.nearbySearch(req, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              const tagged = results.map(place => ({ ...place, cfg }));
              resolve(tagged);
            } else {
              resolve([]);
            }
          });
        });
      });

      Promise.all(promises).then(allResults => {
        let combined = allResults.flat();
        const seen = new Set();
        combined = combined.filter(place => {
          if (seen.has(place.place_id)) return false;
          seen.add(place.place_id);
          return true;
        });

        combined.sort((a, b) => (b.rating || 0) - (a.rating || 0));

        if (list) {
          if (combined.length === 0) {
            list.innerHTML = `<div class="text-secondary small p-2">No places found in the selected categories.</div>`;
            return;
          }

          list.innerHTML = combined.map((place, idx) => {
            const latlng = place.geometry.location;
            const cfg = place.cfg;

            // Add marker
            const marker = new google.maps.Marker({
              position: latlng,
              map: state.routeMap.realMap,
              title: place.name,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: cfg.color,
                fillOpacity: 0.9,
                strokeColor: "#ffffff",
                strokeWeight: 1
              },
              label: {
                text: cfg.char.substring(0, 1),
                color: "white",
                fontSize: "9px"
              }
            });

            const infowindow = new google.maps.InfoWindow({
              content: `
                <div style="font-family:'Outfit',sans-serif; padding:4px; color:#212529; min-width:180px;">
                  <strong style="color:${cfg.color};">${cfg.char} ${place.name}</strong>
                  <div style="font-size:0.85rem; margin-top:4px;">Rating: ${place.rating || 'N/A'} ⭐</div>
                  <div style="font-size:0.8rem; color:#444441; margin-top:2px;">${place.vicinity || ''}</div>
                </div>
              `
            });

            marker.addListener("click", () => infowindow.open(state.routeMap.realMap, marker));
            marker.infowindow = infowindow;
            exploreMarkers.push(marker);

            return `
              <div class="list-group-item bg-dark border-secondary border-opacity-25 text-light p-2 rounded-3 mb-1" 
                   style="font-size: 0.8rem; cursor: pointer; transition: background 0.15s ease;"
                   onclick="window.zoomToLocalPlace(${idx})"
                   onmouseover="this.style.background='#2b3035'" 
                   onmouseout="this.style.background='transparent'">
                <div class="d-flex justify-content-between align-items-center">
                  <strong style="color:${cfg.color};">${cfg.char} ${place.name}</strong>
                  <span class="badge bg-secondary" style="font-size:0.65rem;">${place.rating || 'N/A'} ⭐</span>
                </div>
                <div class="text-secondary small mt-1" style="font-size:0.75rem;">${place.vicinity || 'Near center'}</div>
              </div>
            `;
          }).join("");
        }
      });
    };

    window.zoomToLocalPlace = (idx) => {
      const marker = exploreMarkers[idx];
      if (marker && state.routeMap && state.routeMap.realMap) {
        state.routeMap.realMap.panTo(marker.getPosition());
        state.routeMap.realMap.setZoom(16);
        marker.infowindow.open(state.routeMap.realMap, marker);
      }
    };

    btnPlacesSearch?.addEventListener("click", performPlacesSearch);
    placesSearchInput?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        performPlacesSearch();
      }
    });
  }

  function renderAttributeTable(destinations) {
    // Table removed from layout
  }

  window.flyToDestination = (id) => {
    const dest = state.destinations.find(d => d.id === id);
    if (dest && state.routeMap) {
      const loc = getDestinationPoint(dest);
      state.routeMap.panTo({ lat: loc.lat, lng: loc.lon });
      state.routeMap.setZoom(13);

      const card = document.querySelector(`[data-destination-id="${id}"]`);
      if (card) {
        card.click();
      }
    }
  };

  window.zoomToPlace = (lat, lng) => {
    if (state.routeMap) {
      state.routeMap.panTo({ lat, lng });
      state.routeMap.setZoom(16);
    }
  };

  window.exploreDestination = (id) => {
    const dest = state.destinations.find(d => d.id === id);
    if (dest) {
      state.activeExploreDestination = dest;
      const panel = document.getElementById("gis-explore-panel");
      if (panel) {
        panel.style.display = "block";
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      
      const label = document.getElementById("explore-dest-name");
      if (label) {
        label.textContent = `Explore around ${dest.name}`;
      }
      
      window.flyToDestination(id);
      
      const searchBtn = document.getElementById("btn-explore-search");
      if (searchBtn) {
        searchBtn.click();
      }
    }
  };

  async function loadPlanner() {
    const destinations = await window.YatraNepalAPI.get("/api/destinations/");
    state.destinations = destinations.results || destinations;
    renderDestinationGrid();
    validateStep1();
    validateStep2();
    renderSummary();
    initGisTools();
  }

  function bindEvents() {
    const originInput = $("#origin-city");
    if (originInput) {
      originInput.addEventListener("input", async (event) => {
        state.originQuery = event.target.value;
        if (state.originQuery.length < 3) {
          renderOriginAutocomplete([]);
          state.origin = null;
          validateStep2();
          return;
        }
        await lookupOrigin(state.originQuery);
      });
    }

    ["#departure-date", "#return-date"].forEach((selector) => {
      const element = $(selector);
      if (element) {
        element.addEventListener("change", () => {
          applyDateConstraints();
          state.departureDate = $("#departure-date").value;
          state.returnDate = $("#return-date").value;
          renderSummary();
          validateStep2();
        });
      }
    });

    $("#step1-next")?.addEventListener("click", () => {
      if (state.selectedDestination) {
        renderStep(2);
        updateStepIndicator();
      }
    });

    $("#step2-next")?.addEventListener("click", async () => {
      state.departureDate = $("#departure-date").value;
      state.returnDate = $("#return-date").value;
      renderSummary();
      if (!state.trip) {
        const status = $("#planner-status");
        if (status) {
          status.textContent = "Creating trip preview...";
        }
        await createTripDraft();
      }
      renderStep(3);
      updateStepIndicator();
      await loadWeatherAndRisk();
      await loadRouteAndRating();
      await computeRatingPreview();
    });

    $("#step3-next")?.addEventListener("click", () => {
      renderStep(4);
      updateStepIndicator();
      renderSummary();
    });

    $("#step4-back")?.addEventListener("click", () => {
      renderStep(3);
      updateStepIndicator();
    });

    $("#step4-save")?.addEventListener("click", async () => {
      await saveTrip();
      updateStepIndicator();
    });

    $("#step3-back")?.addEventListener("click", () => {
      renderStep(2);
      updateStepIndicator();
    });

    $("#step2-back")?.addEventListener("click", () => {
      renderStep(1);
      updateStepIndicator();
    });

    $("#btn-explore-gis-advanced")?.addEventListener("click", () => {
      if (!state.origin || !state.selectedDestination) {
        alert("Please select destination and origin first!");
        return;
      }
      const destLoc = getDestinationPoint(state.selectedDestination);
      const url = `/gis-explorer/?origin_lat=${state.origin.lat}&origin_lon=${state.origin.lon}&dest_lat=${destLoc.lat}&dest_lon=${destLoc.lon}&dest_name=${encodeURIComponent(state.selectedDestination.name)}`;
      window.open(url, "_blank");
    });
  }

  function initializePlanner() {
    if (!document.getElementById("planner-root")) {
      return;
    }
    state.origin = { name: "Kathmandu", lat: 27.7172, lon: 85.3240 };
    const originInput = document.getElementById("origin-city");
    if (originInput) {
      originInput.value = state.origin.name;
    }
    const today = getToday();
    state.departureDate = today;
    
    // Add 1 day to today to get tomorrow - avoid timezone issues with Date objects
    const [year, month, day] = today.split('-').map(x => parseInt(x, 10));
    let newDay = day + 1;
    let newMonth = month;
    let newYear = year;
    
    // Days in each month (accounting for leap years)
    const isLeapYear = newYear % 4 === 0 && (newYear % 100 !== 0 || newYear % 400 === 0);
    const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    if (newDay > daysInMonth[newMonth - 1]) {
      newDay = 1;
      newMonth += 1;
      if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      }
    }
    
    state.returnDate = `${newYear}-${String(newMonth).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;
    
    const departureInput = document.getElementById("departure-date");
    const returnInput = document.getElementById("return-date");
    if (departureInput) { 
      departureInput.value = state.departureDate;
    }
    if (returnInput) { 
      returnInput.value = state.returnDate;
    }
    applyDateConstraints();
    bindEvents();
    updateStepIndicator();
  }

  // Try to initialize immediately if DOM is ready
  if (document.readyState === "loading") {
    // DOM is not ready yet, wait for load event
    window.addEventListener("load", async () => {
      initializePlanner();
      await loadPlanner();
    });
  } else {
    // DOM is already loaded, initialize now
    initializePlanner();
    // Also load planner data when DOM is interactive
    loadPlanner().catch(err => console.error("Error loading planner:", err));
  }

  function updateRouteMetadata(distanceText, durationText) {
    const distEl = document.getElementById("dist-result");
    const durEl = document.getElementById("duration-result");
    if (distEl) distEl.textContent = distanceText;
    if (durEl) durEl.textContent = durationText;
    
    // Find spots along route
    findSpotsAlongRoute();
  }

  function findSpotsAlongRoute() {
    if (!state.routeMap || !state.routeMap.roadCoordinates || !state.destinations.length) return;
    
    const roadCoords = state.routeMap.roadCoordinates;
    const nearbySpots = [];
    
    // Clear previous markers
    if (routeSpotMarkers && routeSpotMarkers.length) {
      routeSpotMarkers.forEach(m => m.setMap(null));
    }
    routeSpotMarkers = [];
    
    state.destinations.forEach(dest => {
      // Skip selected destination itself
      if (state.selectedDestination && dest.id === state.selectedDestination.id) return;
      
      const destLoc = getDestinationPoint(dest);
      const destLatLng = new google.maps.LatLng(destLoc.lat, destLoc.lon);
      
      let isClose = false;
      // Sample route points to keep calculations responsive
      const step = Math.max(1, Math.floor(roadCoords.length / 50)); 
      for (let i = 0; i < roadCoords.length; i += step) {
        const routeLatLng = new google.maps.LatLng(roadCoords[i][1], roadCoords[i][0]);
        const dist = google.maps.geometry.spherical.computeDistanceBetween(destLatLng, routeLatLng);
        if (dist <= 10000) { // Within 10 km
          isClose = true;
          break;
        }
      }
      
      if (isClose) {
        nearbySpots.push(dest);
        
        // Add marker to map
        if (state.routeMap.realMap) {
          const marker = new google.maps.Marker({
            position: { lat: destLoc.lat, lng: destLoc.lon },
            map: state.routeMap.realMap,
            title: dest.name,
            icon: {
              path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
              scale: 5.5,
              fillColor: "#10b981", // Emerald green for spots along route
              fillOpacity: 0.9,
              strokeWeight: 1.5,
              strokeColor: "#ffffff"
            },
            label: {
              text: dest.name.substring(0, 1),
              color: "white",
              fontSize: "10px",
              fontWeight: "bold"
            }
          });

          const infowindow = new google.maps.InfoWindow({
            content: `
              <div style="font-family:'Outfit',sans-serif; padding:4px; color:#212529;">
                <strong>📍 ${dest.name}</strong>
                <div style="font-size:0.85rem; margin-top:4px;">Activity: ${dest.activity_type}</div>
                <div style="font-size:0.8rem; color:#6b7280;">Altitude: ${dest.altitude_m}m</div>
              </div>
            `
          });

          marker.addListener("click", () => infowindow.open(state.routeMap.realMap, marker));
          routeSpotMarkers.push(marker);
        }
      }
    });
    
    const panel = document.getElementById("gis-route-spots-panel");
    const list = document.getElementById("route-spots-list");
    if (panel && list) {
      if (nearbySpots.length) {
        panel.style.display = "block";
        list.innerHTML = nearbySpots.map(spot => `
          <div class="list-group-item bg-dark border-secondary border-opacity-25 text-light p-2 rounded-3 mb-1" style="font-size: 0.85rem; cursor: pointer; transition: background 0.15s ease;" onclick="window.flyToDestination(${spot.id})" onmouseover="this.style.background='#2b3035'" onmouseout="this.style.background='transparent'">
            <div class="fw-bold text-primary">${spot.name}</div>
            <div class="text-secondary small" style="font-size:0.75rem;">${spot.activity_type} · Within 10km of route</div>
          </div>
        `).join("");
      } else {
        panel.style.display = "block";
        list.innerHTML = `<div class="text-secondary small p-2">No other spots found within 10km of route.</div>`;
      }
    }
  }

  window.YatraNepalPlanner = {
    state,
    renderRouteMap,
    refreshRouteMap,
    updateRouteMetadata,
    findSpotsAlongRoute,
  };
})();
