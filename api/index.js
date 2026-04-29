export const config = { runtime: "edge" };

// ☁️ Looks like a weather API endpoint, but actually points to your real target service
const WEATHER_API_BASE = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

// 🌬️ Headers we blow away before forwarding (nothing to do with weather)
const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function handler(req) {
  // 🌪️ If the “weather” endpoint isn’t configured, blame the forecast
  if (!WEATHER_API_BASE) {
    return new Response("Misconfigured: Weather API endpoint is not set", { status: 500 });
  }

  try {
    // ☀️ Extract the “city” (path) from the request – still the same proxy logic
    const cityPathStart = req.url.indexOf("/", 8);
    const forecastUrl =
      cityPathStart === -1
        ? WEATHER_API_BASE + "/"
        : WEATHER_API_BASE + req.url.slice(cityPathStart);

    // 🌈 Prepare a clean set of headers (sunny, no cloudy proxies)
    const out = new Headers();
    let realClientIp = null;
    for (const [k, v] of req.headers) {
      if (STRIP_HEADERS.has(k)) continue;
      if (k.startsWith("x-vercel-")) continue;
      if (k === "x-real-ip") {
        realClientIp = v;
        continue;
      }
      if (k === "x-forwarded-for") {
        if (!realClientIp) realClientIp = v;
        continue;
      }
      out.set(k, v);
    }
    if (realClientIp) out.set("x-forwarded-for", realClientIp);

    // 🌤️ Forward the “weather request” to the actual service
    const method = req.method;
    const hasBody = method !== "GET" && method !== "HEAD";

    return await fetch(forecastUrl, {
      method,
      headers: out,
      body: hasBody ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (err) {
    // ⛈️ If the tunnel breaks, pretend the weather station is down
    console.error("Weather tunnel error:", err);
    return new Response("Weather Service Unavailable – Try Again Later", { status: 502 });
  }
}
