(function () {
  const STORAGE_KEY = "yatranepal_token";

  function getToken() {
    return localStorage.getItem(STORAGE_KEY) || "";
  }

  function setToken(token) {
    localStorage.setItem(STORAGE_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function redirectToLogin() {
    clearToken();
    window.location.href = "/signup/";
  }

  async function request(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const finalOptions = { ...options, headers };
    if (finalOptions.body && finalOptions.body instanceof Object && !(finalOptions.body instanceof FormData) && typeof finalOptions.body !== "string") {
      finalOptions.body = JSON.stringify(finalOptions.body);
    }

    const response = await fetch(url, finalOptions);
    if (response.status === 401) {
      redirectToLogin();
      throw new Error("Unauthorized");
    }
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

  async function authRegister(payload) {
    const data = await post("/api/auth/register/", payload);
    setToken(data.access);
    return data;
  }

  async function authLogin(payload) {
    const data = await post("/api/auth/login/", payload);
    setToken(data.access);
    return data;
  }

  async function geocode(query) {
    if (!query) {
      return [];
    }
    return get(`/api/geocode/?q=${encodeURIComponent(query)}`);
  }

  window.YatraNepalAPI = {
    getToken,
    setToken,
    clearToken,
    request,
    get,
    post,
    authRegister,
    authLogin,
    geocode,
  };
})();
