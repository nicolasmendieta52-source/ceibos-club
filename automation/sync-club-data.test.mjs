import test from "node:test";
import assert from "node:assert/strict";
import { expandApifyInstagramImages, extractInstagramStoryMentionImages, mergeClubData, parseInstagramImage, parseInstagramResultsBoard, repairText } from "./sync-club-data.mjs";

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

test("reconoce PreSenior y Sub 20 de futbol", () => {
  const text = `FÚTBOL
SÁBADO - 16/08/2026
PRE SENIOR
vs. Flores
09:00 hs - Cancha: Los Ceibos
SUB 20
vs. San Juan Bautista
15:30 hs - Cancha: Los Ceibos`;
  const records = parseInstagramImage(text, aliases);
  assert.equal(records.length, 2);
  assert.deepEqual(records.map(record => record.categoria), ["PreSenior", "Sub 20"]);
  assert.ok(records.every(record => record.local));
});

test("lee las categorias de un fixture de rugby", () => {
  const text = `CEIBOS RUGBY
SÁBADO - 08/08/2026
PRIMERA
vs. Lobos
15:30 hs - Cancha: Los Ceibos
INTERMEDIA
vs. Lobos
13:30 hs - Cancha: Los Ceibos
PRE INTERMEDIA
vs. Lobos
12:00 hs - Cancha: Los Ceibos
M19
vs. Lobos
10:30 hs - Cancha: Los Ceibos`;
  const records = parseInstagramImage(text, aliases);
  assert.equal(records.length, 4);
  assert.deepEqual(records.map(record => record.categoria), ["Primera", "Intermedia", "Pre Intermedia", "M19"]);
  assert.ok(records.every(record => record.deporte === "rugby" && record.local));
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

test("extrae la imagen de una historia que menciona a la cuenta", () => {
  const payload = {
    data: [{
      id: "conversation-1",
      messages: {
        data: [{
          id: "message-1",
          created_time: "2026-08-07T12:00:00+0000",
          attachments: [{ type: "story_mention", payload: { url: "https://lookaside.fbsbx.com/fixture.jpg" } }]
        }]
      }
    }]
  };
  assert.deepEqual(extractInstagramStoryMentionImages(payload), [{
    id: "story-mention-message-1",
    url: "https://lookaside.fbsbx.com/fixture.jpg",
    permalink: "",
    timestamp: "2026-08-07T12:00:00+0000"
  }]);
});

test("extrae todas las placas de un carrusel obtenido por Apify", () => {
  const posts = [{
    id: "post-1",
    url: "https://www.instagram.com/p/ABC123/",
    timestamp: "2026-08-07T12:00:00.000Z",
    displayUrl: "https://cdn.example/portada.jpg",
    carouselImages: [
      "https://cdn.example/portada.jpg",
      "https://cdn.example/futbol.jpg",
      "https://cdn.example/rugby.jpg"
    ]
  }];
  assert.deepEqual(expandApifyInstagramImages(posts), [
    { id: "apify-post-1-0", url: "https://cdn.example/portada.jpg", permalink: "https://www.instagram.com/p/ABC123/", timestamp: "2026-08-07T12:00:00.000Z" },
    { id: "apify-post-1-1", url: "https://cdn.example/futbol.jpg", permalink: "https://www.instagram.com/p/ABC123/", timestamp: "2026-08-07T12:00:00.000Z" },
    { id: "apify-post-1-2", url: "https://cdn.example/rugby.jpg", permalink: "https://www.instagram.com/p/ABC123/", timestamp: "2026-08-07T12:00:00.000Z" }
  ]);
});
