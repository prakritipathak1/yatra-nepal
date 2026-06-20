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
    const active = state.selectedDestination && state.selectedDestination.id === destination.id ? "selected" : "";
    return `
      <button type="button" class="destination-card ${active}" data-destination-id="${destination.id}">
        <span class="destination-region">${destination.region}</span>
        <h3>${destination.name}</h3>
        <p>${destination.activity_type} · ${destination.difficulty}</p>
        <div class="destination-meta">
          <span>${destination.distance_from_ktm_km} km from KTM</span>
          <span>${destination.permit_required || "No permit"}</span>
        </div>
      </button>
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
      const hasToken = Boolean(window.YatraNepalAPI && window.YatraNepalAPI.getToken && window.YatraNepalAPI.getToken());
      next.disabled = !state.route || !state.weather || (hasToken && !state.rating);
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
    const token = window.YatraNepalAPI && window.YatraNepalAPI.getToken ? window.YatraNepalAPI.getToken() : "";
    if (!token) {
      state.trip = {
        id: `local-${Date.now()}`,
        local: true,
        ...buildTripPayload(),
      };
      return state.trip;
    }
    const trip = await window.YatraNepalAPI.post("/api/trips/", buildTripPayload());
    state.trip = trip;
    return trip;
  }

  function renderSummary() {
    const summary = $("#trip-summary");
    if (!summary) {
      return;
    }
    if (!state.selectedDestination) {
      summary.innerHTML = "<p>Select a destination to see your summary.</p>";
      return;
    }
    summary.innerHTML = `
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
    const weatherScores = state.weather?.forecasts?.map((forecast) => {
      const precip = forecast.precipitation_probability ?? 50;
      const wind = forecast.wind_speed_kmh ?? 10;
      return Math.max(2, Math.min(10, 10 - precip * 0.05 - wind * 0.08));
    }) || [7];
    const weatherScore = Math.max(3, Math.min(10, weatherScores.reduce((sum, value) => sum + value, 0) / weatherScores.length));
    const riskValues = state.risk?.risks?.map((item) => item.probability_percent ?? 40) || [40];
    const avgRisk = riskValues.reduce((sum, value) => sum + value, 0) / riskValues.length;
    const riskScore = Math.max(2, Math.min(10, 10 - avgRisk * 0.08));
    return {
      overall_score: Math.max(4, Math.min(9.5, (weatherScore * 0.4 + riskScore * 0.4 + 7.5 * 0.2)) ),
      weather_score: weatherScore,
      route_safety_score: riskScore,
      activity_fit_score: Math.max(5, Math.min(10, weatherScore + 0.5)),
      infrastructure_score: 7.2,
      crowd_level_score: 6.6,
      disaster_risk_score: riskScore,
      source: "Local estimate",
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
      alerts.innerHTML = "<div class='risk-alert-box'><strong>BIPAD Live Alerts:</strong> <p>District-level incidents are shown on the route map and refresh whenever the route is loaded.</p></div>";
    }
  }

  function renderRating() {
    const ring = $("#rating-ring");
    const bars = $("#rating-bars");
    if (!state.rating) {
      if (bars) bars.innerHTML = "<p>Rating preview is not available yet.</p>";
      return;
    }
    if (ring) {
      ring.style.setProperty("--score", state.rating.overall_score * 10);
      ring.innerHTML = `<strong>${state.rating.overall_score.toFixed(1)}</strong><span>Overall rating</span>`;
    }
    if (bars) {
      const items = [
        ["Weather", state.rating.weather_score],
        ["Route safety", state.rating.route_safety_score],
        ["Activity fit", state.rating.activity_fit_score],
        ["Infrastructure", state.rating.infrastructure_score],
        ["Crowd level", state.rating.crowd_level_score],
        ["Disaster risk", state.rating.disaster_risk_score],
      ];
      bars.innerHTML = items
        .map(
          ([label, value]) => {
            const score = Number(value) || 0;
            return `
          <div class="rating-row">
            <span>${label}</span>
            <div class="rating-track"><i style="width:${Math.max(0, Math.min(100, score * 10))}%"></i></div>
            <strong>${score.toFixed(1)}</strong>
          </div>
        `;
          }
        )
        .join("");
      if (state.rating.source) {
        bars.innerHTML += `<p class="rating-source">Source: ${state.rating.source}</p>`;
      }
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
    state.weather = weather;
    state.risk = risk;
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
    const hasToken = Boolean(window.YatraNepalAPI && window.YatraNepalAPI.getToken && window.YatraNepalAPI.getToken());
    if (!state.trip || !state.weather || !state.risk) {
      state.rating = buildLocalRating();
      renderRating();
      validateStep3();
      return;
    }
    if (!hasToken) {
      state.rating = buildLocalRating();
      renderRating();
      validateStep3();
      return;
    }
    try {
      state.rating = await window.YatraNepalAPI.get(`/api/trips/${state.trip.id}/rating/`);
    } catch (error) {
      state.rating = buildLocalRating();
    }
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
    localStorage.setItem(`yatranepal_alert_subscription_${state.trip.id}`, JSON.stringify({ trip_id: state.trip.id, subscribed: true }));
    renderStep(5);
    const completion = $("#completion-message");
    if (completion) {
      completion.innerHTML = `<h3>Trip saved</h3><p>Your alert subscription is active for ${state.selectedDestination.name}.</p>`;
    }
  }

  async function loadPlanner() {
    const destinations = await window.YatraNepalAPI.get("/api/destinations/");
    state.destinations = destinations.results || destinations;
    renderDestinationGrid();
    validateStep1();
    validateStep2();
    renderSummary();
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

  window.YatraNepalPlanner = {
    state,
    renderRouteMap,
    refreshRouteMap,
  };
})();
