import test from "node:test";
import assert from "node:assert/strict";
import { agruparPorDeporte, clavePartido, detectarEventos, marcarEnviados, minutosDesdeInicio, normalizar, VENTANA_INICIO_MINUTOS } from "./notification-utils.mjs";

test("genera una clave estable aunque cambien mayúsculas y acentos", () => {
  const a = { deporte: "Fútbol", categoria: "Reserva A", rival: "Peñarol", fecha: "2026-08-22", hora: "10:00" };
  const b = { deporte: "futbol", categoria: "RESERVA A", rival: "PENAROL", fecha: "2026-08-22", hora: "11:00" };
  assert.equal(clavePartido(a), clavePartido(b));
  assert.equal(normalizar("Intermedia C"), "intermedia c");
});

test("detecta partidos nuevos futuros y recordatorios del día sin duplicar", () => {
  const anterior = { partidos: [{ deporte: "rugby", categoria: "Primera", rival: "Lobos", fecha: "2026-08-22" }] };
  const nuevo = { deporte: "hockey", categoria: "Reserva", rival: "Old Girls", fecha: "2026-08-23", hora: "15:00" };
  const hoy = { deporte: "futbol", categoria: "Primera", rival: "Old Boys", fecha: "2026-08-20", hora: "16:00" };
  const actual = { partidos: [...anterior.partidos, nuevo, hoy] };
  const eventos = detectarEventos(anterior, actual, { sentNew: {}, sentToday: {} }, "2026-08-20");
  assert.deepEqual(eventos.nuevos, [nuevo, hoy]);
  assert.deepEqual(eventos.delDia, [hoy]);
  const estado = marcarEnviados({ sentNew: {}, sentToday: {} }, "new", eventos.nuevos);
  marcarEnviados(estado, "today", eventos.delDia);
  const repetidos = detectarEventos(anterior, actual, estado, "2026-08-20");
  assert.equal(repetidos.nuevos.length, 0);
  assert.equal(repetidos.delDia.length, 0);
});

test("avisa al comenzar el partido y no repite el aviso", () => {
  const partido = { deporte: "futbol", categoria: "Primera", rival: "Old Boys", fecha: "2026-08-20", hora: "15:00" };
  const ahora = new Date("2026-08-20T18:05:00Z");
  const estado = { sentNew: {}, sentToday: {}, sentStart: {} };
  const eventos = detectarEventos({ partidos: [partido] }, { partidos: [partido] }, estado, "2026-08-20", ahora);
  assert.deepEqual(eventos.inician, [partido]);
  marcarEnviados(estado, "start", eventos.inician);
  const repetido = detectarEventos({ partidos: [partido] }, { partidos: [partido] }, estado, "2026-08-20", ahora);
  assert.equal(repetido.inician.length, 0);
  const antes = detectarEventos({ partidos: [partido] }, { partidos: [partido] }, { sentStart: {} }, "2026-08-20", new Date("2026-08-20T17:59:00Z"));
  const demorado = detectarEventos({ partidos: [partido] }, { partidos: [partido] }, { sentStart: {} }, "2026-08-20", new Date("2026-08-20T18:31:00Z"));
  const demasiadoTarde = detectarEventos({ partidos: [partido] }, { partidos: [partido] }, { sentStart: {} }, "2026-08-20", new Date("2026-08-20T22:00:00Z"));
  assert.equal(antes.inician.length, 0);
  assert.deepEqual(demorado.inician, [partido]);
  assert.equal(demasiadoTarde.inician.length, 0);
  assert.equal(VENTANA_INICIO_MINUTOS, 240);
  assert.equal(minutosDesdeInicio(partido, new Date("2026-08-20T18:31:00Z")), 31);
});

test("agrupa avisos según el deporte elegido", () => {
  const grupos = agruparPorDeporte([
    { deporte: "futbol", categoria: "Primera" },
    { deporte: "futbol", categoria: "Reserva A" },
    { deporte: "rugby", categoria: "M19" }
  ]);
  assert.equal(grupos.get("futbol").length, 2);
  assert.equal(grupos.get("rugby").length, 1);
});

test("recupera un aviso demorado que cruzo la medianoche", () => {
  const ahora = new Date("2026-08-17T03:30:00.000Z");
  const partido = { deporte: "basketball", categoria: "Basketball", rival: "Rival", fecha: "2026-08-16", hora: "23:30" };
  assert.equal(minutosDesdeInicio(partido, ahora, "2026-08-17"), 60);
  const eventos = detectarEventos({ partidos: [] }, { partidos: [partido] }, {}, "2026-08-17", ahora);
  assert.equal(eventos.inician.length, 1);
});
