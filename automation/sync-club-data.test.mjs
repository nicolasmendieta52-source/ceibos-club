import test from "node:test";
import assert from "node:assert/strict";
import { mergeClubData, parseInstagramImage, parseInstagramResultsBoard, repairText } from "./sync-club-data.mjs";

const aliases = ["CEIBOS", "CEIBOS CLUB", "LOS CEIBOS"];

test("lee varias categorias de un carrusel de proximos partidos", () => {
  const text = `F\u00daTBOL
S\u00c1BADO - 09/08/2026
PRIMERA
vs. Old Boys Club
15:30 hs - Cancha: Los Ceibos
RESERVA A
vs. Azulgrana
09:00 hs - Cancha: Los Ceibos
RESERVA VERDE
vs. San Isidro Lomas
11:15 hs - Cancha: San Isidro Lomas`;
  const records = parseInstagramImage(text, aliases);
  assert.equal(records.length, 3);
  assert.deepEqual(records.map(record => record.categoria), ["Primera", "Reserva A", "Reserva Verde"]);
  assert.equal(records[0].hora, "15:30");
  assert.equal(records[0].local, true);
  assert.equal(records[2].local, false);
});

test("lee una placa de resultados con varias categorias", () => {
  const text = `CEIBOS RUGBY RESULTADOS
PRIMERA - 20 JUNIO 2026
CEIBOS
28 : 42
LOBOS
INTERMEDIA - 20 JUNIO 2026
CEIBOS
21 : 26
LOBOS`;
  const records = parseInstagramResultsBoard(text, aliases);
  assert.equal(records.length, 2);
  assert.deepEqual(records[0], { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "LOBOS", fecha: "2026-06-20", gf: 28, gc: 42 });
});

test("elimina duplicados y conserva la hora confirmada", () => {
  const previous = {
    partidos: [{ deporte: "basketball", categoria: "Basketball", rival: "Universidad Cat\u00f3lica", fecha: "2026-08-08", hora: "19:15", local: true }],
    resultados: []
  };
  const official = [{ kind: "partido", deporte: "basketball", categoria: "Basketball", rival: "UNIVERSIDAD CATOLICA", fecha: "2026-08-08", hora: "A confirmar", local: true }];
  const merged = mergeClubData(previous, official, []);
  assert.equal(merged.partidos.length, 1);
  assert.equal(merged.partidos[0].hora, "19:15");
});

test("quita de proximos un partido que ya tiene resultado", () => {
  const previous = { partidos: [{ deporte: "futbol", categoria: "Primera", rival: "Old Boys", fecha: "2026-08-01", hora: "15:30", local: true }], resultados: [] };
  const official = [{ kind: "resultado", deporte: "futbol", categoria: "Primera", rival: "Old Boys", fecha: "2026-08-01", gf: 2, gc: 1 }];
  const merged = mergeClubData(previous, official, []);
  assert.equal(merged.partidos.length, 0);
  assert.equal(merged.resultados.length, 1);
});

test("repara nombres guardados con codificacion incorrecta", () => {
  assert.equal(repairText("PE\u00c3\u2018AROL"), "PE\u00d1AROL");
  assert.equal(repairText("Pe\u00c3\u00b1arol"), "Pe\u00f1arol");
});
