const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRequestManager(options = {}) {
  const cacheDir = options.cacheDir || path.join(process.cwd(), ".cache", "http");
  const ttlMs = options.ttlMs || 6 * 60 * 60 * 1000;
  const requestLimit = options.requestLimit || 40;
  const perHostDelayMs = options.perHostDelayMs || 400;
  const maxRetries = options.maxRetries || 2;
  const timeoutMs = options.timeoutMs || 10000;
  const userAgent =
    options.userAgent ||
    "world-problems-bot/1.0 (+https://world-problems-blog.vercel.app)";
  let requestCount = 0;
  const hostNextAvailable = new Map();

  function ensureCacheDir() {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  function cachePathFor(url) {
    const hash = crypto.createHash("sha256").update(url).digest("hex");
    return path.join(cacheDir, `${hash}.json`);
  }

  function readCache(url, ttlOverrideMs) {
    ensureCacheDir();
    const cachePath = cachePathFor(url);
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    try {
      const raw = fs.readFileSync(cachePath, "utf8");
      const parsed = JSON.parse(raw);
      const ttl = typeof ttlOverrideMs === "number" ? ttlOverrideMs : ttlMs;
      if (!parsed?.fetchedAt || Date.now() - parsed.fetchedAt > ttl) {
        return null;
      }
      return parsed;
    } catch (error) {
      console.warn(`Failed to read cache for ${url}:`, error);
      return null;
    }
  }

  function writeCache(url, payload) {
    ensureCacheDir();
    const cachePath = cachePathFor(url);
    fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2), "utf8");
  }

  async function waitForHost(hostname) {
    const now = Date.now();
    const next = hostNextAvailable.get(hostname) || 0;
    if (now < next) {
      await sleep(next - now);
    }
    const jitter = Math.floor(Math.random() * 200);
    hostNextAvailable.set(hostname, Date.now() + perHostDelayMs + jitter);
  }

  async function fetchWithRetry(url, options = {}) {
    const cached = readCache(url, options.ttlMs);
    if (cached) {
      return { ok: true, status: cached.status, body: cached.body, fromCache: true };
    }

    if (requestCount >= requestLimit) {
      return { ok: false, skipped: true, status: 0, body: "" };
    }

    requestCount += 1;
    const hostname = new URL(url).hostname;
    await waitForHost(hostname);

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method: options.method || "GET",
          headers: {
            "User-Agent": userAgent,
            Accept: options.accept || "text/plain",
            ...(options.headers || {})
          },
          signal: controller.signal
        });
        clearTimeout(timeout);
        const body = await response.text();
        const payload = {
          fetchedAt: Date.now(),
          status: response.status,
          body
        };
        writeCache(url, payload);
        return { ok: response.ok, status: response.status, body, fromCache: false };
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        const backoffBase = 400 * 2 ** attempt;
        const jitter = Math.floor(Math.random() * 300);
        await sleep(backoffBase + jitter);
      }
    }

    return { ok: false, status: 0, error: lastError, body: "" };
  }

  async function fetchText(url, options = {}) {
    return fetchWithRetry(url, { ...options, accept: "text/plain" });
  }

  async function fetchJson(url, options = {}) {
    const response = await fetchWithRetry(url, {
      ...options,
      accept: "application/json"
    });
    if (!response.ok) {
      return { ...response, data: null };
    }
    try {
      return { ...response, data: JSON.parse(response.body) };
    } catch (error) {
      return { ...response, ok: false, error, data: null };
    }
  }

  return {
    fetchText,
    fetchJson,
    getRequestCount: () => requestCount,
    getRequestLimit: () => requestLimit
  };
}

module.exports = { createRequestManager };
