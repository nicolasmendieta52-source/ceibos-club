const COOKIE_NAME = "ceibos_access";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const encoder = new TextEncoder();

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let different = 0;
  for (let index = 0; index < left.length; index += 1) {
    different |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return different === 0;
}

function readCookie(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  for (const item of cookies.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

async function createSession(accessCode, sessionSecret) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const codeHash = await sha256(accessCode);
  const signature = await sign(`${expires}.${codeHash}`, sessionSecret);
  return `v1.${expires}.${signature}`;
}

async function hasValidSession(request, accessCode, sessionSecret) {
  const value = readCookie(request, COOKIE_NAME);
  const [version, expiresText, suppliedSignature] = value.split(".");
  if (version !== "v1" || !expiresText || !suppliedSignature) return false;

  const expires = Number(expiresText);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(expires) || expires <= now || expires > now + SESSION_SECONDS) {
    return false;
  }

  const codeHash = await sha256(accessCode);
  const expectedSignature = await sign(`${expires}.${codeHash}`, sessionSecret);
  return safeEqual(suppliedSignature, expectedSignature);
}

function safeRedirect(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function constructionResponse(context, options = {}) {
  const assetUrl = new URL("/construction.html", context.request.url);
  const asset = await context.env.ASSETS.fetch(new Request(assetUrl));
  let html = await asset.text();

  const configured = Boolean(context.env.ACCESS_CODE && context.env.SESSION_SECRET);
  const errorMessage = options.error
    ? "El código no es correcto. Revisalo e intentá nuevamente."
    : "";
  const setupMessage = configured
    ? ""
    : "El acceso privado todavía está siendo configurado.";

  html = html
    .replaceAll("{{REDIRECT}}", escapeHtml(options.redirect || "/"))
    .replaceAll("{{ERROR_MESSAGE}}", errorMessage)
    .replaceAll("{{ERROR_CLASS}}", errorMessage ? "access-message is-visible" : "access-message")
    .replaceAll("{{SETUP_MESSAGE}}", setupMessage)
    .replaceAll("{{SETUP_CLASS}}", setupMessage ? "setup-message is-visible" : "setup-message")
    .replaceAll("{{FORM_DISABLED}}", configured ? "" : "disabled");

  const headers = new Headers(asset.headers);
  headers.set("Content-Type", "text/html; charset=UTF-8");
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Retry-After", "3600");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  );

  return new Response(html, {
    status: options.error ? 401 : 503,
    headers,
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.pathname === "/robots.txt") {
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: {
        "Content-Type": "text/plain; charset=UTF-8",
        "Cache-Control": "no-store",
      },
    });
  }

  if (
    url.pathname === "/assets/icono-app-ceibos.png" ||
    url.pathname === "/assets/escudo-ceibos.png" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    return context.next();
  }

  if (url.pathname === "/__salir") {
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/",
        "Set-Cookie": `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
        "Cache-Control": "no-store",
      },
    });
  }

  const configured = Boolean(env.ACCESS_CODE && env.SESSION_SECRET);

  if (url.pathname === "/__acceso" && request.method === "POST") {
    if (!configured) return constructionResponse(context);

    const formData = await request.formData();
    const suppliedCode = String(formData.get("code") || "").trim();
    const expectedCode = String(env.ACCESS_CODE).trim();
    const redirect = safeRedirect(String(formData.get("redirect") || "/"));
    const [suppliedHash, expectedHash] = await Promise.all([
      sha256(suppliedCode),
      sha256(expectedCode),
    ]);

    if (!suppliedCode || !safeEqual(suppliedHash, expectedHash)) {
      return constructionResponse(context, { error: true, redirect });
    }

    const session = await createSession(expectedCode, env.SESSION_SECRET);
    return new Response(null, {
      status: 303,
      headers: {
        Location: redirect,
        "Set-Cookie": `${COOKIE_NAME}=${session}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (
    configured &&
    (await hasValidSession(request, String(env.ACCESS_CODE).trim(), env.SESSION_SECRET))
  ) {
    const response = await context.next();
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return constructionResponse(context, {
    redirect: safeRedirect(`${url.pathname}${url.search}`),
  });
}
