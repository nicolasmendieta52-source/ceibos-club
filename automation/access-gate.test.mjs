import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { onRequest } from "../functions/_middleware.js";

const constructionHtml = await readFile(new URL("../construction.html", import.meta.url), "utf8");

function contextFor(request, overrides = {}) {
  return {
    request,
    env: {
      ACCESS_CODE: "Ceibos-Prueba-2026",
      SESSION_SECRET: "una-clave-de-sesion-larga-y-distinta",
      ASSETS: {
        fetch: async () => new Response(constructionHtml, {
          headers: { "Content-Type": "text/html" },
        }),
      },
      ...overrides,
    },
    next: async () => new Response("SITIO PRIVADO", { status: 200 }),
  };
}

test("oculta el sitio para visitantes sin sesión", async () => {
  const request = new Request("https://ceibosclub.com/#fixture");
  const response = await onRequest(contextFor(request));
  assert.equal(response.status, 503);
  assert.match(await response.text(), /Estamos\s*<span>construyendo/);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
});

test("falla cerrado si todavía no hay secretos configurados", async () => {
  const request = new Request("https://ceibosclub.com/");
  const response = await onRequest(contextFor(request, {
    ACCESS_CODE: "",
    SESSION_SECRET: "",
  }));
  assert.equal(response.status, 503);
  const html = await response.text();
  assert.match(html, /todavía está siendo configurado/);
  assert.match(html, /disabled/);
});

test("rechaza un código incorrecto", async () => {
  const body = new URLSearchParams({ code: "incorrecto", redirect: "/#fixture" });
  const request = new Request("https://ceibosclub.com/__acceso", {
    method: "POST",
    body,
  });
  const response = await onRequest(contextFor(request));
  assert.equal(response.status, 401);
  assert.match(await response.text(), /El código no es correcto/);
});

test("crea una sesión segura y permite ingresar", async () => {
  const body = new URLSearchParams({
    code: "Ceibos-Prueba-2026",
    redirect: "/#fixture",
  });
  const loginRequest = new Request("https://ceibosclub.com/__acceso", {
    method: "POST",
    body,
  });
  const loginResponse = await onRequest(contextFor(loginRequest));
  assert.equal(loginResponse.status, 303);
  assert.equal(loginResponse.headers.get("Location"), "/#fixture");

  const setCookie = loginResponse.headers.get("Set-Cookie");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Lax/);
  const cookie = setCookie.split(";", 1)[0];

  const privateRequest = new Request("https://ceibosclub.com/", {
    headers: { Cookie: cookie },
  });
  const privateResponse = await onRequest(contextFor(privateRequest));
  assert.equal(privateResponse.status, 200);
  assert.equal(await privateResponse.text(), "SITIO PRIVADO");
});

test("no acepta redirecciones externas", async () => {
  const body = new URLSearchParams({
    code: "Ceibos-Prueba-2026",
    redirect: "//sitio-malicioso.example",
  });
  const request = new Request("https://ceibosclub.com/__acceso", {
    method: "POST",
    body,
  });
  const response = await onRequest(contextFor(request));
  assert.equal(response.headers.get("Location"), "/");
});
