(function () {
  async function request(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const finalOptions = { credentials: "same-origin", ...options, headers };
    if (finalOptions.body && finalOptions.body instanceof Object && !(finalOptions.body instanceof FormData) && typeof finalOptions.body !== "string") {
      finalOptions.body = JSON.stringify(finalOptions.body);
    }

    const response = await fetch(url, finalOptions);
    if (response.status === 204) {
      return null;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.detail || data.error || "Request failed";
      throw new Error(message);
    }
    return data;
  }

  async function get(url) {
    return request(url, { method: "GET" });
  }

  async function post(url, body) {
    return request(url, { method: "POST", body });
  }

  async function geocode(query) {
    if (!query) {
      return [];
    }
    return get(`/api/geocode/?q=${encodeURIComponent(query)}`);
  }

  window.YatraNepalAPI = {
    request,
    get,
    post,
    geocode,
  };
})();

