import test from "node:test";
import assert from "node:assert/strict";
import { agruparPorDeporte, clavePartido, detectarEventos, marcarEnviados, normalizar } from "./notification-utils.mjs";

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

test("agrupa avisos según el deporte elegido", () => {
  const grupos = agruparPorDeporte([
    { deporte: "futbol", categoria: "Primera" },
    { deporte: "futbol", categoria: "Reserva A" },
    { deporte: "rugby", categoria: "M19" }
  ]);
  assert.equal(grupos.get("futbol").length, 2);
  assert.equal(grupos.get("rugby").length, 1);
});
