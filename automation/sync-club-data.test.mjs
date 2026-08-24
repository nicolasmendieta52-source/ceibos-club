import test from "node:test";
import assert from "node:assert/strict";
import { expandApifyInstagramImages, extractInstagramStoryMentionImages, mergeClubData, parseG22TeamApi, parseHockeyLine, parseInstagramImage, parseInstagramResultsBoard, repairText, verifiedRugbyResults2026 } from "./sync-club-data.mjs";

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

test("infiere hockey cuando el OCR pierde el encabezado", () => {
  const text = `SABADO - 08/08
Sub 18 vs. Seminario
14:00 hs - Cancha: Seminario
Reserva vs. Seminario
15:45 hs - Cancha: Seminario
Inter A vs. Old Girls
19:15 hs - Cancha: British`;
  const records = parseInstagramImage(text, aliases);
  assert.equal(records.length, 3);
  assert.deepEqual(records.map(record => record.categoria), ["Sub 18", "Reserva", "Intermedia A"]);
  assert.ok(records.every(record => record.deporte === "hockey"));
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

test("mantiene pendientes de FUH aunque la tabla muestre 0-0", () => {
  const source = { deporte: "hockey", categoria: "Intermedia A" };
  for (const estado of ["A Jugar", "A Designar", "Postergado"]) {
    const record = parseHockeyLine(`Old Girls Azulgrana - Los Ceibos\tFecha 1\t08/08 19:15\tBritish\t0 - 0\t${estado}`, source, aliases);
    assert.equal(record.kind, "partido");
    assert.equal(record.rival, "Old Girls Azulgrana");
  }
});

test("FUH pendiente elimina un marcador anterior de la misma fecha", () => {
  const previous = {
    partidos: [],
    resultados: [{ deporte: "hockey", categoria: "Intermedia A", rival: "Old Girls Azulgrana", fecha: "2026-08-08", gf: 0, gc: 4 }]
  };
  const official = [{ kind: "partido", deporte: "hockey", categoria: "Intermedia A", rival: "Old Girls", fecha: "2026-08-08", hora: "19:15", local: false, cancha: "British" }];
  const instagram = [{ kind: "resultado", deporte: "hockey", categoria: "Intermedia A", rival: "Old Girls Azulgrana", fecha: "2026-08-08", gf: 0, gc: 4 }];
  const merged = mergeClubData(previous, official, instagram);
  assert.equal(merged.resultados.length, 0);
  assert.equal(merged.partidos.length, 1);
});

test("los resultados verificados de Primera de Rugby prevalecen sobre OCR", () => {
  const previous = { partidos: [], resultados: [] };
  const instagram = [
    { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "PSG", fecha: "2026-05-23", gf: 22, gc: 22 },
    { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "Los Cuervos", fecha: "2026-06-06", gf: 17, gc: 26 }
  ];
  const merged = mergeClubData(previous, verifiedRugbyResults2026, instagram);
  const psg = merged.resultados.find(record => record.fecha === "2026-05-23");
  const cuervos = merged.resultados.find(record => record.fecha === "2026-06-06");
  assert.deepEqual([psg.gf, psg.gc], [21, 21]);
  assert.deepEqual([cuervos.gf, cuervos.gc], [17, 36]);
});

test("lee resultados de Rugby directamente desde G22 y orienta el marcador a Ceibos", () => {
  const source = { deporte: "rugby", categoria: "Primera", teamId: "ceibos-club" };
  const payload = {
    ok: true,
    resolvedClubId: "ceibos-club",
    results: [
      { home_team: { team_id: "seminario", name: "Seminario" }, away_team: { team_id: "ceibos-club", name: "Ceibos Club" }, scores: { home: 24, away: 32 }, match_status: "final", timestamp: 1773496800 },
      { home_team: { team_id: "ceibos-club", name: "Ceibos Club" }, away_team: { team_id: "psg", name: "PSG" }, scores: { home: 21, away: 21 }, match_status: "final", timestamp: 1779561000 }
    ],
    fixtures: []
  };
  const records = parseG22TeamApi(payload, source, aliases);
  assert.equal(records.length, 2);
  assert.deepEqual([records[0].gf, records[0].gc], [32, 24]);
  assert.deepEqual([records[1].gf, records[1].gc], [21, 21]);
  assert.ok(records.every(record => record.kind === "resultado"));
});

test("G22 mantiene un 0-0 programado como partido pendiente", () => {
  const source = { deporte: "rugby", categoria: "Primera", teamId: "ceibos-club" };
  const payload = {
    ok: true,
    resolvedClubId: "ceibos-club",
    results: [],
    fixtures: [{
      home_team: { team_id: "lobos", name: "Lobos" },
      away_team: { team_id: "ceibos-club", name: "Ceibos Club" },
      scores: { home: 0, away: 0 },
      match_status: "scheduled",
      timestamp: 1781982000
    }]
  };
  const [record] = parseG22TeamApi(payload, source, aliases);
  assert.equal(record.kind, "partido");
  assert.equal(record.rival, "Lobos");
  assert.equal(record.local, false);
  assert.equal("gf" in record, false);
});

test("un resultado oficial directo reemplaza otro marcador de la misma fecha", () => {
  const previous = { partidos: [], resultados: [{ deporte: "rugby", categoria: "Primera", rival: "PSG Rugby", fecha: "2026-05-23", gf: 22, gc: 22 }] };
  const official = [{ kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "PSG", fecha: "2026-05-23", gf: 21, gc: 21 }];
  const merged = mergeClubData(previous, official, []);
  assert.deepEqual(merged.resultados, [{ deporte: "rugby", categoria: "Primera", rival: "PSG", fecha: "2026-05-23", gf: 21, gc: 21 }]);
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
