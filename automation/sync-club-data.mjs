import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(directory, "../data/club-data.json");
const configPath = path.resolve(directory, "fuentes.json");
const ocrCachePath = path.resolve(directory, "../data/instagram-ocr-cache.json");
const now = new Date();
const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();

// Marcadores de Primera verificados para la temporada 2026. Se incorporan
// con prioridad oficial para que una lectura OCR incompleta o equivocada no
// pueda reemplazarlos en futuras sincronizaciones.
const verifiedRugbyResults2026 = [
  { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "Seminario", fecha: "2026-03-14", gf: 32, gc: 24 },
  { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "Old Christians", fecha: "2026-04-11", gf: 7, gc: 60 },
  { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "Carrasco Polo", fecha: "2026-04-18", gf: 8, gc: 39 },
  { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "Montevideo Cricket", fecha: "2026-04-25", gf: 29, gc: 26 },
  { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "Círculo de Tenis", fecha: "2026-05-02", gf: 38, gc: 7 },
  { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "Champagnat", fecha: "2026-05-09", gf: 26, gc: 6 },
  { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "PSG", fecha: "2026-05-23", gf: 21, gc: 21 },
  { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "Old Boys", fecha: "2026-05-30", gf: 0, gc: 43 },
  { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "Los Cuervos", fecha: "2026-06-06", gf: 17, gc: 36 },
  { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "Trébol de Paysandú", fecha: "2026-06-13", gf: 5, gc: 45 },
  { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "Lobos", fecha: "2026-06-20", gf: 28, gc: 42 },
  { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "Lobos", fecha: "2026-07-25", gf: 19, gc: 28 },
  { kind: "resultado", deporte: "rugby", categoria: "Primera", rival: "Seminario", fecha: "2026-08-01", gf: 13, gc: 13 }
];

function repairText(value) {
  let text = clean(value);
  const controls = new Map([["‘", 0x91], ["’", 0x92], ["“", 0x93], ["”", 0x94], ["–", 0x96], ["—", 0x97]]);
  for (let pass = 0; pass < 2 && /[ÃÂâð]/.test(text); pass += 1) {
    const bytes = [...text].map(character => controls.has(character) ? String.fromCharCode(controls.get(character)) : character).join("");
    const repaired = Buffer.from(bytes, "latin1").toString("utf8");
    if (!repaired || repaired.includes("�")) break;
    text = repaired;
  }
  return text.replace(/\s+[–—]\s+/g, " – ").trim();
}

const comparable = value => repairText(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("es")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function dateFromDayMonth(day, month) {
  if (!Number.isInteger(day) || !Number.isInteger(month) || day < 1 || day > 31 || month < 1 || month > 12) return "";
  const year = now.getFullYear();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isTeam(value, aliases) {
  const team = comparable(value);
  return aliases.some(alias => {
    const expected = comparable(alias);
    return team === expected || (expected === "ceibos" && /^(?:club |los )?ceibos(?: club| verde)?$/.test(team));
  });
}

function parseHockeyLine(line, source, aliases) {
  const cells = String(line).split("\t").map(clean).filter(Boolean);
  if (cells.length < 6) return null;
  const teams = cells[0].split(/\s+-\s+/).map(clean);
  if (teams.length !== 2) return null;
  const [home, away] = teams;
  if (!isTeam(home, aliases) && !isTeam(away, aliases)) return null;
  const date = cells[2].match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2})/);
  if (!date) return null;
  const local = isTeam(home, aliases);
  const fecha = dateFromDayMonth(Number(date[1]), Number(date[2]));
  const score = cells[4].match(/^(\d+)\s*-\s*(\d+)$/);
  const cerrado = cells[5].toLocaleLowerCase("es").includes("cerrado");
  if (cerrado && score) {
    const [homeScore, awayScore] = [Number(score[1]), Number(score[2])];
    return { kind: "resultado", deporte: source.deporte, categoria: source.categoria, rival: local ? away : home, gf: local ? homeScore : awayScore, gc: local ? awayScore : homeScore, fecha };
  }
  return { kind: "partido", deporte: source.deporte, categoria: source.categoria, rival: local ? away : home, fecha, hora: date[3], local, cancha: repairText(cells[3]) };
}

function parseLine(line, source, aliases) {
  if (source.formato === "hockey-admin") return parseHockeyLine(line, source, aliases);
  const raw = String(line);
  const cells = raw.split("\t").map(clean).filter(Boolean);
  const text = clean(raw);
  if (!aliases.some(alias => comparable(text).includes(comparable(alias)))) return null;

  // Tablas oficiales de la Liga Universitaria: fecha, cancha, local, goles, visitante, goles.
  if (cells.length >= 6 && /^\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}$/.test(cells[0]) && /^\d+$/.test(cells[3]) && /^\d+$/.test(cells[5])) {
    const [day, month] = cells[0].match(/^(\d{1,2})-(\d{1,2})/).slice(1).map(Number);
    const [home, away] = [cells[2], cells[4]];
    if (!isTeam(home, aliases) && !isTeam(away, aliases)) return null;
    const local = isTeam(home, aliases);
    return { kind: "resultado", deporte: source.deporte, categoria: source.categoria, rival: local ? away : home, gf: Number(local ? cells[3] : cells[5]), gc: Number(local ? cells[5] : cells[3]), fecha: dateFromDayMonth(day, month) };
  }

  // Tablas oficiales de próximos partidos: fecha ISO, cancha, local, visitante.
  if (cells.length >= 4 && /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}:\d{2}$/.test(cells[0])) {
    const [home, away] = [cells[2], cells[3]];
    if (!isTeam(home, aliases) && !isTeam(away, aliases)) return null;
    const local = isTeam(home, aliases);
    return { kind: "partido", deporte: source.deporte, categoria: source.categoria, rival: local ? away : home, fecha: cells[0].slice(0, 10), hora: cells[0].slice(11, 16) === "00:00" ? "A confirmar" : cells[0].slice(11, 16), local, cancha: repairText(cells[1]) };
  }

  const date = text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  const time = text.match(/\b(\d{1,2}:\d{2})\b/)?.[1] ?? "";
  const score = text.match(/\b(\d+)\s*[-–]\s*(\d+)\b/);
  const beforeDate = date ? text.slice(0, text.indexOf(date[0])) : text;
  const teams = beforeDate.split(/\s+-\s+/).map(clean).filter(Boolean);
  if (teams.length < 2 || !date) return null;
  const [home, away] = teams.slice(-2);
  const isHome = aliases.some(alias => home.toLocaleLowerCase("es").includes(alias.toLocaleLowerCase("es")));
  const rival = isHome ? away : home;
  if (!rival) return null;
  const fecha = dateFromDayMonth(Number(date[1]), Number(date[2]));
  if (score) {
    const homeScore = Number(score[1]);
    const awayScore = Number(score[2]);
    return { kind: "resultado", deporte: source.deporte, categoria: source.categoria, rival, gf: isHome ? homeScore : awayScore, gc: isHome ? awayScore : homeScore, fecha };
  }
  return { kind: "partido", deporte: source.deporte, categoria: source.categoria, rival, fecha, hora: time, local: isHome };
}

function parseText(text, source, aliases) {
  return text.split(/\n|\r|(?<=Cerrado)|(?<=Pendiente)/).map(line => parseLine(line, source, aliases)).filter(Boolean);
}

function ligaDateTime(value) {
  const match = clean(value).match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
  return match ? { fecha: match[1], hora: match[2] || "A confirmar" } : null;
}

function ligaOwnGoal(value) {
  return ["1", "true", "si", "sí"].includes(comparable(value));
}

function ligaGoalMinute(value) {
  const minute = clean(value).replace(/[^0-9+]/g, "");
  return minute ? `${minute}'` : "";
}

function parseLigaResultsApi(rows, source, aliases, goalsByMatchId = new Map()) {
  if (!Array.isArray(rows)) throw new Error("La Liga Universitaria no devolvio una lista de resultados");
  const records = [];
  for (const row of rows) {
    const home = repairText(row.Locatario);
    const away = repairText(row.Visitante);
    const homeIsCeibos = isTeam(home, aliases);
    const awayIsCeibos = isTeam(away, aliases);
    if (homeIsCeibos === awayIsCeibos) continue;
    const dateTime = ligaDateTime(row.Fecha_Hora);
    const homeScore = Number(row.GL);
    const awayScore = Number(row.GV);
    if (!dateTime || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;

    const goalEvents = goalsByMatchId.get(String(row.ID)) ?? [];
    const goleadores = [...goalEvents]
      .filter(goal => clean(goal.Nombre))
      .sort((left, right) => Number.parseInt(clean(left.minutos), 10) - Number.parseInt(clean(right.minutos), 10))
      .map(goal => {
        const minute = ligaGoalMinute(goal.minutos);
        const ownGoal = ligaOwnGoal(goal.EnContra) ? " · en contra" : "";
        return `${repairText(goal.Nombre)}${minute ? ` (${minute})` : ""}${ownGoal}`;
      });

    records.push({
      kind: "resultado",
      deporte: source.deporte,
      categoria: source.categoria,
      rival: homeIsCeibos ? away : home,
      fecha: dateTime.fecha,
      gf: homeIsCeibos ? homeScore : awayScore,
      gc: homeIsCeibos ? awayScore : homeScore,
      ...(goleadores.length ? { goleadores } : {})
    });
  }
  return records;
}

async function fetchLigaJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "CeibosClubFixtureBot/1.0 (contacto: info@ceibosclub.com)",
        accept: "application/json",
        "cache-control": "no-cache"
      },
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} al consultar la Liga Universitaria`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const output = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      output[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}

async function fetchLigaResultsWithScorers(source, aliases) {
  const pageResponse = await fetch(source.url, {
    headers: { "user-agent": "CeibosClubFixtureBot/1.0 (contacto: info@ceibosclub.com)", "cache-control": "no-cache" },
    cache: "no-store"
  });
  if (!pageResponse.ok) throw new Error(`HTTP ${pageResponse.status} al abrir resultados de la Liga Universitaria`);
  const page = await pageResponse.text();
  const configId = page.match(/<meta\s+name=["']config-id["']\s+content=["']([^"']+)["']/i)?.[1];
  if (!configId) throw new Error("La pagina de resultados no informa su config-id");

  const configurations = await fetchLigaJson(new URL("../config/config.json", source.url));
  const configuration = Array.isArray(configurations)
    ? configurations.find(item => String(item.ID) === String(configId))
    : null;
  if (!configuration) throw new Error(`No se encontro la configuracion ${configId} de la Liga Universitaria`);

  const apiUrl = new URL("api.php", source.url);
  apiUrl.search = new URLSearchParams({
    action: "cargarPartidos",
    temporada: configuration.Temporada,
    deporte: configuration.Deporte,
    torneo: configuration.Torneo,
    categoria: configuration.Categoria,
    serie: configuration.Serie
  }).toString();
  const rows = await fetchLigaJson(apiUrl);
  if (!Array.isArray(rows)) throw new Error("La Liga Universitaria no devolvio los resultados esperados");

  const ceibosRows = rows.filter(row => isTeam(row.Locatario, aliases) !== isTeam(row.Visitante, aliases));
  const scorerEntries = await mapWithConcurrency(ceibosRows, 4, async row => {
    const action = isTeam(row.Locatario, aliases) ? "GolesLocatario" : "GolesVisitante";
    const goalsUrl = new URL("api.php", source.url);
    goalsUrl.search = new URLSearchParams({ action, id: String(row.ID) }).toString();
    const goals = await fetchLigaJson(goalsUrl);
    return [String(row.ID), Array.isArray(goals) ? goals : []];
  });
  return parseLigaResultsApi(rows, source, aliases, new Map(scorerEntries));
}

function uruguayDateTime(timestamp) {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(seconds * 1000)).map(part => [part.type, part.value]));
  return { fecha: `${parts.year}-${parts.month}-${parts.day}`, hora: `${parts.hour}:${parts.minute}` };
}

function parseG22TeamApi(payload, source, aliases = []) {
  const data = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (!data || data.ok === false) throw new Error("G22 no devolvió una respuesta válida");
  const teamId = comparable(source.teamId ?? data.resolvedClubId ?? "ceibos-club");
  const belongsToCeibos = team => comparable(team?.team_id) === teamId || isTeam(team?.name, aliases);
  const records = [];
  for (const match of [...(data.results ?? []), ...(data.fixtures ?? [])]) {
    const home = match.home_team ?? {};
    const away = match.away_team ?? {};
    const homeIsCeibos = belongsToCeibos(home);
    const awayIsCeibos = belongsToCeibos(away);
    if (homeIsCeibos === awayIsCeibos) continue;
    const dateTime = uruguayDateTime(match.timestamp);
    if (!dateTime) continue;
    const rival = repairText(homeIsCeibos ? away.name : home.name);
    if (!rival) continue;
    const status = comparable(match.match_status);
    const homeScore = Number(match.scores?.home);
    const awayScore = Number(match.scores?.away);
    const isFinal = ["final", "finished", "closed", "cerrado"].includes(status) && Number.isFinite(homeScore) && Number.isFinite(awayScore);
    if (isFinal) {
      records.push({
        kind: "resultado",
        deporte: source.deporte,
        categoria: source.categoria,
        rival,
        fecha: dateTime.fecha,
        gf: homeIsCeibos ? homeScore : awayScore,
        gc: homeIsCeibos ? awayScore : homeScore
      });
      continue;
    }
    records.push({
      kind: "partido",
      deporte: source.deporte,
      categoria: source.categoria,
      rival,
      fecha: dateTime.fecha,
      hora: dateTime.hora,
      local: homeIsCeibos,
      ...(clean(match.venue?.name ?? match.venue ?? match.location) ? { cancha: repairText(match.venue?.name ?? match.venue ?? match.location) } : {})
    });
  }
  return records;
}

function categoria5022(competition) {
  const label = comparable(`${competition?.category ?? ""} ${competition?.name ?? ""}`);
  if (/\btop 12\b|\bprimera\b/.test(label)) return "Primera";
  if (/\bintermedia\b/.test(label)) return "Intermedia";
  if (/\bm ?19\b|\bsub ?19\b/.test(label)) return "M19";
  return "";
}

function isoDateTimeUruguay(value) {
  const raw = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;
  if (!raw.includes("T")) return { fecha: raw.slice(0, 10), hora: "A confirmar" };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(parsed).map(part => [part.type, part.value]));
  return { fecha: `${parts.year}-${parts.month}-${parts.day}`, hora: `${parts.hour}:${parts.minute}` };
}

function parse5022PublicContent(payload, source, aliases = []) {
  const data = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (!data || !Array.isArray(data.matches) || !Array.isArray(data.competitions)) {
    throw new Error("50/22 no devolvio partidos y competencias en el formato esperado");
  }
  const competitions = new Map(data.competitions.map(competition => [String(competition.id), competition]));
  const season = clean(source.temporada);
  const records = [];
  for (const match of data.matches) {
    const competition = competitions.get(String(match.competition_id));
    const categoria = categoria5022(competition);
    const competitionYear = clean(competition?.season) || clean(competition?.name).match(/\b20\d{2}\b/)?.[0] || "";
    if (!categoria || (season && competitionYear !== season)) continue;
    const homeIsCeibos = isTeam(match.home_club_name, aliases);
    const awayIsCeibos = isTeam(match.away_club_name, aliases);
    if (homeIsCeibos === awayIsCeibos) continue;
    const dateTime = isoDateTimeUruguay(match.date);
    if (!dateTime) continue;
    const rival = repairText(homeIsCeibos ? match.away_club_name : match.home_club_name);
    if (!rival) continue;
    const status = comparable(match.status);
    const homeScore = Number(match.home_score);
    const awayScore = Number(match.away_score);
    const isFinal = ["completed", "final", "finished", "closed", "cerrado"].includes(status)
      && match.home_score !== null && match.away_score !== null
      && Number.isFinite(homeScore) && Number.isFinite(awayScore);
    if (isFinal) {
      records.push({
        kind: "resultado",
        deporte: "rugby",
        categoria,
        rival,
        fecha: dateTime.fecha,
        gf: homeIsCeibos ? homeScore : awayScore,
        gc: homeIsCeibos ? awayScore : homeScore
      });
      continue;
    }
    records.push({
      kind: "partido",
      deporte: "rugby",
      categoria,
      rival,
      fecha: dateTime.fecha,
      hora: dateTime.hora,
      local: homeIsCeibos,
      ...(clean(match.venue) && comparable(match.venue) !== "a confirmar" ? { cancha: repairText(match.venue) } : {})
    });
  }
  return records;
}

function parseInstagramDate(value) {
  const match = clean(value).match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!match) return "";
  const year = Number(match[3] ?? now.getFullYear());
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const sinAcentos = comparable;

function deporteDesdePlaca(text) {
  const value = sinAcentos(text);
  if (value.includes("futbol")) return "futbol";
  if (value.includes("hockey")) return "hockey";
  if (value.includes("rugby")) return "rugby";
  if (value.includes("basket") || value.includes("basquet")) return "basketball";
  // En algunas placas el OCR pierde el logo que dice HOCKEY, pero conserva
  // las divisionales exclusivas Inter A/B/C. Eso alcanza para identificar el
  // deporte sin depender de textos o hashtags del post.
  if (/\binter(?:media)?\s*[abc]\b/.test(value)) return "hockey";
  return "";
}

function categoriaDesdePlaca(text) {
  const value = sinAcentos(text);
  const categorias = [
    ["reserva verde", "Reserva Verde"], ["reserva a", "Reserva A"],
    ["primera", "Primera"], ["pre intermedia", "Pre Intermedia"],
    ["preintermedia", "Pre Intermedia"], ["pre senior", "PreSenior"], ["presenior", "PreSenior"],
    ["sub 20", "Sub 20"], ["sub 18", "Sub 18"], ["m19", "M19"], ["m 19", "M19"],
    ["intermedia a", "Intermedia A"],
    ["inter a", "Intermedia A"], ["intermedia b", "Intermedia B"], ["inter b", "Intermedia B"],
    ["intermedia c", "Intermedia C"], ["inter c", "Intermedia C"], ["intermedia", "Intermedia"],
    ["basketball", "Basketball"], ["reserva", "Reserva"]
  ];
  return categorias.find(([needle]) => value.includes(needle))?.[1] ?? "";
}

const meses = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12
};

function fechaDesdePlacaDeResultados(text) {
  const value = sinAcentos(text);
  const match = value.match(/\b(\d{1,2})\s*(?:de\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s*(\d{4}))?\b/i);
  if (!match) return "";
  return `${match[3] ?? now.getFullYear()}-${String(meses[match[2].toLowerCase()]).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
}

function categoriaCanonicaDeResultados(value, deporte) {
  const categoria = categoriaDesdePlaca(value);
  // En las placas de fútbol figura solamente "Reserva", pero en la web esa
  // categoría se llama Reserva A. La conservamos con el nombre del sitio.
  return categoria === "Reserva" && deporte === "futbol" ? "Reserva A" : categoria;
}

function esTextoDeCabecera(value) {
  const normalized = sinAcentos(value);
  return !value || normalized.includes("resultados") || normalized.includes("ceibos") ||
    Boolean(categoriaDesdePlaca(value)) || Boolean(fechaDesdePlacaDeResultados(value));
}

function rivalDesdeBloqueDeResultados(block) {
  const lines = block.split(/\r?\n/).map(clean).filter(Boolean);
  const scoreLineIndex = lines.findIndex(line => /\d{1,2}\s*[:\-]\s*\d{1,2}/.test(line));
  if (scoreLineIndex < 0) return "";
  const afterScore = clean(lines[scoreLineIndex].replace(/^.*?\d{1,2}\s*[:\-]\s*\d{1,2}\s*/, ""));
  if (/[A-Za-zÁÉÍÓÚÜÑ]/.test(afterScore) && !esTextoDeCabecera(afterScore)) return afterScore;
  return lines.slice(scoreLineIndex + 1)
    .find(line => /[A-Za-zÁÉÍÓÚÜÑ]/.test(line) && !esTextoDeCabecera(line)) ?? "";
}

// Resultados publicados como las historias de Ceibos Fútbol: una sola placa
// contiene varios bloques (categoría, fecha, Ceibos, marcador y rival).
// No utiliza ni el texto ni los hashtags de Instagram: solamente el contenido
// que se ve en la imagen.
function parseInstagramResultsBoard(text, aliases) {
  if (!sinAcentos(text).includes("resultado")) return [];
  const categoryHeader = /(?:primera|reserva\s+verde|reserva\s+a|reserva|pre\s*intermedia|preintermedia|pre\s*senior|presenior|sub\s*20|sub\s*18|m\s*19|intermedia\s*[abc]?|inter\s*[abc]|basketball)\s*[-–—]?\s*\d{0,2}\s*(?:de\s*)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)?\s*\d{0,4}/gi;
  const headers = [...text.matchAll(categoryHeader)];
  const records = [];
  const deporte = deporteDesdePlaca(text) || "futbol";
  for (let index = 0; index < headers.length; index += 1) {
    const start = headers[index].index ?? 0;
    const end = headers[index + 1]?.index ?? text.length;
    const block = text.slice(start, end);
    const categoria = categoriaCanonicaDeResultados(headers[index][0], deporte);
    const fecha = fechaDesdePlacaDeResultados(block);
    const score = block.match(/\b(\d{1,2})\s*[:\-]\s*(\d{1,2})\b/);
    const rival = clean(rivalDesdeBloqueDeResultados(block));
    if (!categoria || !fecha || !score || !rival || isTeam(rival, aliases)) continue;
    records.push({
      kind: "resultado",
      deporte,
      categoria,
      rival,
      fecha,
      gf: Number(score[1]),
      gc: Number(score[2])
    });
  }
  return records;
}

function parseInstagramImage(text, aliases) {
  text = String(text ?? "").split(/\r?\n/).map(repairText).join("\n");
  const resultsBoard = parseInstagramResultsBoard(text, aliases);
  if (resultsBoard.length) return resultsBoard;
  const deporte = deporteDesdePlaca(text);
  const categoria = categoriaDesdePlaca(text);
  const dateMatch = text.match(/(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)?\s*[-–—:]?\s*\b(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?:\s*[\/.\-]\s*(\d{2,4}))?\b/i);
  if (!deporte || !categoria || !dateMatch) return [];
  const fecha = parseInstagramDate(`${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3] ?? now.getFullYear()}`);
  if (!fecha) return [];
  const lines = text.split(/\r?\n/).map(repairText).filter(Boolean);
  const result = [];
  const categoryPositions = lines
    .map((line, index) => ({ index, categoria: categoriaDesdePlaca(line) }))
    .filter(item => item.categoria);
  const blocks = categoryPositions.length ? categoryPositions : [{ index: 0, categoria }];
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];
    const next = blocks[blockIndex + 1]?.index ?? lines.length;
    const fragment = lines.slice(block.index, Math.min(next, block.index + 8)).join(" ");
    const versus = fragment.match(/\b(?:vs\.?|v\.?|versus)\s*[:.-]?\s*([^\d]{2,100}?)(?=\s+\d{1,2}[:.]\d{2}|\s+(?:hs?\b|cancha\b|local\b|visitante\b)|$)/i);
    if (!versus) continue;
    const rival = repairText(versus[1].replace(/[|]+$/g, ""));
    if (!rival || isTeam(rival, aliases)) continue;
    const horaMatch = fragment.match(/\b(\d{1,2})[:.](\d{2})\b/);
    const hora = horaMatch ? `${horaMatch[1].padStart(2, "0")}:${horaMatch[2]}` : "A confirmar";
    const cancha = repairText(fragment.match(/\bcancha\s*[:.-]?\s*(.{2,80}?)(?=\s+(?:de\s+local|de\s+visita|local|visitante)\b|$)/i)?.[1] ?? "");
    const local = /\b(?:ceibos|pilares)\b/i.test(comparable(cancha)) || /\bde\s+local\b/i.test(fragment);
    // En las placas de fixture, una expresiÃ³n como 15:30 es un horario. Los
    // marcadores se procesan arriba, solamente cuando la imagen dice RESULTADOS.
    result.push({ kind: "partido", deporte, categoria: block.categoria, rival, fecha, hora, local, cancha });
  }
  return result;
}

async function instagramRequest(endpoint, token) {
  const response = await fetch(`https://graph.instagram.com${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.text();
  let payload;
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const apiError = payload?.error ?? {};
    const detail = [apiError.message, apiError.code && `código ${apiError.code}`, apiError.error_subcode && `subcódigo ${apiError.error_subcode}`]
      .filter(Boolean)
      .join("; ");
    throw new Error(`Instagram API respondió ${response.status} en ${endpoint.split("?")[0]}${detail ? `: ${detail}` : ""}`);
  }
  return payload;
}

async function expandInstagramImages(posts, token) {
  const images = [];
  for (const post of posts) {
    let items = [post];
    if (post.media_type === "CAROUSEL_ALBUM") {
      items = post.children?.data ?? [];
      if (!items.length) {
        try {
          const children = await instagramRequest(`/${post.id}/children?fields=id,media_type,media_url,thumbnail_url`, token);
          items = children.data ?? [];
        } catch (error) {
          console.warn(`instagram: no se pudieron abrir las imágenes del carrusel ${post.id} (${error.message})`);
        }
      }
    }
    for (const item of items) {
      if (item.media_type !== "IMAGE" || !(item.media_url || item.thumbnail_url)) continue;
      images.push({
        id: String(item.id ?? `${post.id}-${images.length}`),
        url: item.media_url ?? item.thumbnail_url,
        permalink: post.permalink ?? "",
        timestamp: post.timestamp ?? ""
      });
    }
  }
  return images;
}

function extractInstagramStoryMentionImages(payload) {
  const images = new Map();

  function visit(value, context = {}) {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, context);
      return;
    }
    if (typeof value !== "object") return;

    const marker = comparable([value.type, value.source, value.ref].filter(Boolean).join(" "));
    const storyMention = context.storyMention
      || marker.includes("story mention")
      || Object.prototype.hasOwnProperty.call(value, "story_mention");
    const nextContext = {
      storyMention,
      id: String(value.id ?? value.mid ?? context.id ?? ""),
      timestamp: value.created_time ?? value.timestamp ?? context.timestamp ?? ""
    };

    if (storyMention) {
      const candidates = [
        value.url,
        value.media_url,
        value.payload?.url,
        value.story?.url,
        value.story_mention?.url,
        value.image_data?.url
      ];
      for (const url of candidates) {
        if (typeof url !== "string" || !/^https?:\/\//i.test(url)) continue;
        const id = nextContext.id || `story-mention-${images.size + 1}`;
        if (!images.has(url)) images.set(url, { id: `story-mention-${id}`, url, permalink: "", timestamp: nextContext.timestamp });
      }
    }

    for (const child of Object.values(value)) visit(child, nextContext);
  }

  visit(payload);
  return [...images.values()];
}

async function readInstagramStoryMentions(token) {
  try {
    // Instagram no tiene historias coautoradas. Cuando otra cuenta menciona a
    // ceibosfutbol, Meta la expone como una conversacion con un adjunto
    // story_mention. La tarea periodica consulta esas conversaciones para no
    // necesitar un servidor permanente de webhooks.
    const fields = encodeURIComponent("id,updated_time,messages.limit(20){id,created_time,from,attachments}");
    const payload = await instagramRequest(`/me/conversations?platform=instagram&fields=${fields}&limit=20`, token);
    const recentLimit = Date.now() - (72 * 60 * 60 * 1000);
    const recent = (payload.data ?? []).filter(conversation => {
      const updated = Date.parse(conversation.updated_time ?? "");
      return !Number.isFinite(updated) || updated >= recentLimit;
    });
    const images = extractInstagramStoryMentionImages({ data: recent });
    console.log(`instagram: ${images.length} historias mencionadas para revisar`);
    return { images, available: true };
  } catch (error) {
    console.log(`instagram: las historias mencionadas no están disponibles (${error.message}). El token necesita instagram_business_manage_messages`);
    return { images: [], available: false };
  }
}

function expandApifyInstagramImages(posts) {
  const images = new Map();
  for (const post of posts ?? []) {
    const candidates = [
      ...(Array.isArray(post.carouselImages) ? post.carouselImages : []),
      ...(Array.isArray(post.images) ? post.images : []),
      ...(Array.isArray(post.carousel_media) ? post.carousel_media : []),
      post.displayUrl,
      post.image
    ];
    const urls = candidates
      .map(value => typeof value === "string" ? value : value?.url ?? value?.displayUrl)
      .filter(value => typeof value === "string" && /^https?:\/\//i.test(value));
    const uniqueUrls = [...new Set(urls)];
    for (let index = 0; index < uniqueUrls.length; index += 1) {
      const id = clean(post.id ?? post.shortCode ?? post.code ?? "post");
      const key = `${id}-${index}`;
      if (!images.has(key)) images.set(key, {
        id: `apify-${key}`,
        url: uniqueUrls[index],
        permalink: post.url ?? post.inputUrl ?? "",
        timestamp: post.timestamp ?? post.takenAtIso ?? ""
      });
    }
  }
  return [...images.values()];
}

async function readApifyInstagramPosts() {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.log("instagram/apify: falta el secreto APIFY_TOKEN; se usa solamente la API oficial de Meta");
    return { images: [], posts: 0, available: false };
  }
  // La cuenta principal publica las placas de todos los deportes. Apify lee
  // solamente su perfil público: no necesita usuario, contraseña ni cookies.
  const profile = clean(process.env.APIFY_INSTAGRAM_PROFILE ?? "ceibos_club").replace(/^@/, "");
  const limit = Math.max(1, Math.min(20, Number(process.env.APIFY_INSTAGRAM_RESULTS_LIMIT ?? 8)));
  const endpoint = "https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?clean=true&format=json";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      directUrls: [`https://www.instagram.com/${profile}/`],
      resultsType: "posts",
      resultsLimit: limit,
      onlyPostsNewerThan: "14 days",
      skipPinnedPosts: true
    }),
    signal: AbortSignal.timeout(240000)
  });
  const body = await response.text();
  let posts;
  try {
    posts = body ? JSON.parse(body) : [];
  } catch {
    posts = [];
  }
  if (!response.ok) {
    const detail = clean(posts?.error?.message ?? posts?.message ?? body).slice(0, 240);
    throw new Error(`Apify respondió ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  if (!Array.isArray(posts)) throw new Error("Apify devolvió un formato inesperado");
  const images = expandApifyInstagramImages(posts);
  console.log(`instagram/apify: ${posts.length} publicaciones públicas y ${images.length} imágenes para revisar`);
  return { images, posts: posts.length, available: true };
}

async function readInstagramPosts(aliases) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const apifyToken = process.env.APIFY_TOKEN;
  if (!token && !apifyToken) {
    console.log("instagram: sin token de Meta ni de Apify; se omite la lectura de carruseles");
    return null;
  }
  let officialPosts = [];
  if (token) {
    try {
      // Pedimos solamente los campos del post. Las imágenes internas de cada
      // carrusel se consultan después mediante /children.
      officialPosts = (await instagramRequest("/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,timestamp&limit=40", token)).data ?? [];
    } catch (error) {
      console.warn(`instagram: la API oficial no pudo leer publicaciones (${error.message}); se intenta Apify`);
    }
  }
  // Los resultados se suelen compartir en historias. Cuando el token permite
  // leerlas, también analizamos las que siguen activas (24 horas). Para el
  // historial, los carruseles publicados continúan siendo la fuente estable.
  let stories = [];
  if (token) {
    try {
      stories = (await instagramRequest("/me/stories?fields=id,media_type,media_url,thumbnail_url,timestamp&limit=25", token)).data ?? [];
      console.log(`instagram: ${stories.length} historias activas para revisar`);
    } catch {
      console.log("instagram: las historias activas no están disponibles; se leen los carruseles publicados");
    }
  }

  const storyMentions = token ? await readInstagramStoryMentions(token) : { images: [], available: false };
  let apify = { images: [], posts: 0, available: false };
  try {
    apify = await readApifyInstagramPosts();
  } catch (error) {
    console.warn(`instagram/apify: no se pudo actualizar (${error.message}); se conserva la API oficial como respaldo`);
  }

  const maxImages = Math.max(10, Number(process.env.INSTAGRAM_OCR_MAX_IMAGES ?? 70));
  const officialImages = token ? await expandInstagramImages([...officialPosts, ...stories], token) : [];
  // Apify ve el feed público tal como aparece en el perfil, incluidas las
  // colaboraciones. Si está configurado, ese feed reemplaza las publicaciones
  // oficiales para evitar procesarlas dos veces. Las historias siguen llegando
  // por la API oficial de Meta.
  const feedImages = apify.available ? apify.images : officialImages;
  const images = [...new Map([...storyMentions.images, ...feedImages].map(image => [image.id, image])).values()].slice(0, maxImages);
  if (!images.length) return { matches: [], imagesRead: 0, recognized: 0, cached: 0, apifyPosts: apify.posts, storyMentions: storyMentions.images.length };

  const OCR_CACHE_VERSION = 2;
  const cache = JSON.parse(await fs.readFile(ocrCachePath, "utf8").catch(() => "{}"));
  if (cache.version !== OCR_CACHE_VERSION) cache.items = {};
  cache.version = OCR_CACHE_VERSION;
  cache.items ??= {};
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa+eng");
  await worker.setParameters({
    // Las placas de Ceibos tienen bloques de texto alineados. El modo 6 lee
    // mejor las filas completas que el modo de texto disperso.
    tessedit_pageseg_mode: "6",
    preserve_interword_spaces: "1"
  });
  const matches = [];
  let recognized = 0;
  let cached = 0;
  let sparseFallbacks = 0;
  try {
    for (const image of images) {
      let text = cache.items[image.id]?.text;
      let imageMatches = [];
      if (typeof text === "string") {
        cached += 1;
        imageMatches = parseInstagramImage(text, aliases);
      } else {
        try {
          const { data } = await worker.recognize(image.url);
          text = data.text ?? "";
          recognized += 1;
          imageMatches = parseInstagramImage(text, aliases);
          // Si el diseño separa mucho las palabras, hacemos una segunda
          // lectura de texto disperso en una cantidad acotada de imágenes.
          if (!imageMatches.length && sparseFallbacks < 12) {
            await worker.setParameters({ tessedit_pageseg_mode: "11", preserve_interword_spaces: "1" });
            const sparse = (await worker.recognize(image.url)).data.text ?? "";
            sparseFallbacks += 1;
            text = `${text}\n${sparse}`.trim();
            imageMatches = parseInstagramImage(text, aliases);
            await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
          }
          cache.items[image.id] = {
            text,
            seenAt: new Date().toISOString(),
            permalink: image.permalink,
            timestamp: image.timestamp
          };
        } catch (error) {
          console.warn(`instagram: no se pudo leer la imagen ${image.id} (${error.message})`);
          continue;
        }
      }
      if (!imageMatches.length) {
        const sample = repairText(text);
        if (/ceibos|futbol|fútbol|hockey|rugby|basket|reserva|intermedia|pre\s*senior|presenior|sub\s*(?:18|20)|m\s*19/i.test(sample)) {
          console.log(`instagram OCR sin coincidencia útil: ${sample.slice(0, 220)}`);
        }
      }
      matches.push(...imageMatches);
    }
  } finally {
    await worker.terminate();
  }

  cache.items = Object.fromEntries(Object.entries(cache.items)
    .sort(([, a], [, b]) => String(b.seenAt ?? "").localeCompare(String(a.seenAt ?? "")))
    .slice(0, 240));
  await fs.writeFile(ocrCachePath, `${JSON.stringify(cache, null, 2)}\n`);
  const partidos = matches.filter(match => match.kind === "partido").length;
  const resultados = matches.filter(match => match.kind === "resultado").length;
  console.log(`instagram: ${partidos} partidos y ${resultados} resultados encontrados en ${images.length} imágenes (${apify.posts} publicaciones de Apify, ${storyMentions.images.length} historias mencionadas, ${cached} desde caché, ${recognized} nuevas, ${sparseFallbacks} con segunda lectura)`);
  return { matches, imagesRead: images.length, recognized, cached, apifyPosts: apify.posts, storyMentions: storyMentions.images.length };
}

let browserInstance;

async function getBrowser() {
  const { chromium } = await import("playwright");
  if (browserInstance) return browserInstance;
  const candidates = process.platform === "win32" ? [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean) : [];
  let executablePath;
  for (const candidate of candidates) {
    if (await fs.access(candidate).then(() => true).catch(() => false)) { executablePath = candidate; break; }
  }
  browserInstance = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  return browserInstance;
}

async function renderPage(source) {
  const browser = await getBrowser();
  const page = await browser.newPage({ userAgent: "CeibosClubFixtureBot/1.0 (contacto: info@ceibosclub.com)" });
  try {
    await page.goto(source.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    // Forzamos una recarga equivalente a F5 antes de leer la tabla. Algunas
    // federaciones actualizan el fixture dentro de la misma URL y pueden
    // conservar una respuesta anterior durante unos minutos.
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator("table").first().waitFor({ state: "attached", timeout: 10000 }).catch(() => {});
    // Hockey muestra el fixture en una pestaña oculta y body.innerText solo
    // devuelve la clasificación. Leemos las celdas de cada fila para conservar
    // el orden: partido, fecha, horario, cancha, resultado y estado.
    if (source.formato === "hockey-admin") {
      const fixtureTab = page.locator('a[href^="#tab_3_"]');
      const fixtureCount = await fixtureTab.count();
      for (let index = 0; index < fixtureCount; index += 1) {
        // Algunas categorías de FUH tienen Apertura y fases posteriores en la
        // misma página. Activamos cada pestaña para que todas sus tablas se
        // carguen antes de extraer los partidos.
        await fixtureTab.nth(index).click();
        await page.waitForTimeout(400);
      }
    }
    // Todas las fuentes oficiales publican los datos en tablas. Conservamos
    // cada fila como una línea con tabulaciones, que es más confiable que
    // body.innerText para no separar fecha, equipos y marcadores.
    const rows = await page.locator("table tr").evaluateAll(rows => rows.map(row =>
      [...row.querySelectorAll("th, td")]
        .map(cell => cell.innerText.replace(/\s+/g, " ").trim())
        .join("\t")
    ).filter(Boolean).join("\n"));
    if (rows) return rows;
    return await page.locator("body").innerText();
  } finally {
    await page.close();
  }
}

function normalizeRecord(record, kind, priority = 0) {
  const deporte = comparable(record.deporte).replace(/basquetbol|basquet/g, "basketball");
  const categoria = repairText(record.categoria);
  const rival = repairText(record.rival);
  const fecha = clean(record.fecha);
  if (!deporte || !categoria || !rival || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  if (kind === "resultado") {
    const gf = Number(record.gf);
    const gc = Number(record.gc);
    if (!Number.isFinite(gf) || !Number.isFinite(gc)) return null;
    const goleadores = Array.isArray(record.goleadores)
      ? record.goleadores.map(repairText).filter(Boolean)
      : clean(record.goleadores) ? [repairText(record.goleadores)] : [];
    return { deporte, categoria, rival, gf, gc, fecha, ...(goleadores.length ? { goleadores } : {}), _priority: priority };
  }
  const hora = /^\d{2}:\d{2}$/.test(clean(record.hora)) ? clean(record.hora) : "A confirmar";
  return {
    deporte,
    categoria,
    rival,
    fecha,
    hora,
    local: Boolean(record.local),
    ...(clean(record.cancha) ? { cancha: repairText(record.cancha) } : {}),
    _priority: priority
  };
}

function recordIdentity(record) {
  return [record.deporte, record.categoria, record.rival, record.fecha].map(comparable).join("|");
}

async function fetchDirectSource(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const method = clean(source.metodo || "GET").toUpperCase();
    const response = await fetch(source.url, {
      method,
      headers: {
        "user-agent": "CeibosClubFixtureBot/1.0 (contacto: info@ceibosclub.com)",
        accept: "application/json",
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
        "cache-control": "no-cache"
      },
      ...(method === "POST" ? { body: JSON.stringify(source.body ?? {}) } : {}),
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} al consultar la fuente directa`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function recordSlotIdentity(record) {
  return [record.deporte, record.categoria, record.fecha].map(comparable).join("|");
}

function recordQuality(record, kind) {
  const priority = Number(record._priority ?? 0) * 100;
  if (kind === "resultado") return priority;
  const confirmedTime = /^\d{2}:\d{2}$/.test(record.hora) ? 1_000 : 0;
  const hasVenue = clean(record.cancha) ? 10 : 0;
  return confirmedTime + priority + hasVenue;
}

function dedupeRecords(records, kind) {
  const selected = new Map();
  for (const record of records) {
    const normalized = normalizeRecord(record, kind, Number(record._priority ?? 0));
    if (!normalized) continue;
    const key = recordIdentity(normalized);
    const previous = selected.get(key);
    if (!previous || recordQuality(normalized, kind) > recordQuality(previous, kind)) selected.set(key, normalized);
  }
  return [...selected.values()]
    .map(({ _priority, ...record }) => record)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.deporte.localeCompare(b.deporte) || a.categoria.localeCompare(b.categoria));
}

function mergeClubData(previous, officialRecords, instagramRecords) {
  const replaceUpcoming = new Set(officialRecords
    .filter(record => record.kind === "partido")
    .map(record => `${comparable(record.deporte)}|${comparable(record.categoria)}`));
  const officialUpcoming = new Set(officialRecords.filter(record => record.kind === "partido").map(recordIdentity));
  // Las federaciones son la fuente de verdad. Un registro oficial (resultado
  // o pendiente) reemplaza cualquier marcador OCR de la misma categoría y
  // fecha. Así un 0-0 programado nunca se publica como resultado definitivo.
  const officialSlots = new Set(officialRecords.map(recordSlotIdentity));
  const officialResultSlots = new Set(officialRecords.filter(record => record.kind === "resultado").map(recordSlotIdentity));
  const priorPartidos = (previous.partidos ?? [])
    .filter(record => !officialResultSlots.has(recordSlotIdentity(record)))
    .filter(record => !replaceUpcoming.has(`${comparable(record.deporte)}|${comparable(record.categoria)}`) || officialUpcoming.has(recordIdentity(record)))
    .map(record => ({ ...record, _priority: 0 }));
  const officialPartidos = officialRecords.filter(record => record.kind === "partido").map(record => ({ ...record, _priority: 2 }));
  const instagramPartidos = instagramRecords
    .filter(record => record.kind === "partido" && !officialSlots.has(recordSlotIdentity(record)))
    .map(record => ({ ...record, _priority: 1 }));
  const officialResultados = officialRecords.filter(record => record.kind === "resultado").map(record => ({ ...record, _priority: 2 }));
  const instagramResultados = instagramRecords
    .filter(record => record.kind === "resultado" && !officialSlots.has(recordSlotIdentity(record)))
    .map(record => ({ ...record, _priority: 1 }));
  const priorResultados = (previous.resultados ?? [])
    .filter(record => !officialSlots.has(recordSlotIdentity(record)))
    .map(record => ({ ...record, _priority: 0 }));
  const resultados = dedupeRecords([...priorResultados, ...instagramResultados, ...officialResultados], "resultado");
  const played = new Set(resultados.map(recordIdentity));
  const partidos = dedupeRecords([...priorPartidos, ...instagramPartidos, ...officialPartidos], "partido")
    .filter(record => !played.has(recordIdentity(record)));
  return { partidos, resultados };
}

async function main() {
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  const previous = JSON.parse(await fs.readFile(dataPath, "utf8").catch(() => "{}"));
  const officialRecords = [];
  const sourceStatus = [];
  for (const source of config.sources) {
    try {
      // G22 ofrece los datos de Rugby en JSON. Las demás federaciones todavía
      // requieren Chromium porque construyen sus tablas con JavaScript.
      let matches;
      if (source.deporte === "futbol" && source.url.includes("/resultados/")) {
        matches = await fetchLigaResultsWithScorers(source, config.teamAliases);
      } else {
        const text = source.modo === "direct" ? await fetchDirectSource(source) : await renderPage(source);
        matches = source.formato === "g22-team-api"
          ? parseG22TeamApi(text, source, config.teamAliases)
          : source.formato === "5022-public-content"
            ? parse5022PublicContent(text, source, config.teamAliases)
            : parseText(text, source, config.teamAliases);
      }
      console.log(`${source.deporte}: ${matches.length} partidos encontrados`);
      officialRecords.push(...matches);
      sourceStatus.push({ deporte: source.deporte, categoria: source.categoria, url: source.url, registros: matches.length, estado: matches.length ? "ok" : "sin-coincidencias" });
    } catch (error) {
      console.warn(`${source.deporte}: no se pudo actualizar (${error.message})`);
      sourceStatus.push({ deporte: source.deporte, categoria: source.categoria, url: source.url, registros: 0, estado: "error", detalle: error.message });
    }
  }
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = undefined;
  }
  let instagramRecords = [];
  let instagramStatus = { estado: "sin-token", registros: 0, imagenes: 0 };
  try {
    const instagram = await readInstagramPosts(config.teamAliases);
    if (instagram) {
      instagramRecords = instagram.matches;
      instagramStatus = { estado: instagram.matches.length ? "ok" : "sin-coincidencias", registros: instagram.matches.length, imagenes: instagram.imagesRead, publicacionesApify: instagram.apifyPosts, historiasMencionadas: instagram.storyMentions, cache: instagram.cached, nuevas: instagram.recognized };
    }
  } catch (error) {
    console.warn(`instagram: no se pudo actualizar (${error.message})`);
    instagramStatus = { estado: "error", registros: 0, imagenes: 0, detalle: error.message };
  }
  // Si ninguna fuente respondió, no tocamos el JSON existente ni marcamos el
  // trabajo como exitoso. GitHub Actions debe avisar el fallo para no dejar un
  // fixture aparentemente actualizado pero con información vieja.
  if (officialRecords.length === 0 && instagramRecords.length === 0) {
    throw new Error("Las fuentes respondieron, pero no se encontrÃ³ ningÃºn partido o resultado. Se conservaron los datos anteriores.");
  }
  // Una fuente puede no responder momentáneamente. Conservamos los datos que
  // ya estaban publicados y sumamos los nuevos, para que un deporte nunca
  // borre los resultados de los demás.
  // Los marcadores verificados sirven como respaldo para fechas que G22 aún
  // no cerró o que ya no expone. Cuando G22 sí devuelve el resultado, el dato
  // directo prevalece y no se duplica.
  const directResultSlots = new Set(officialRecords.filter(record => record.kind === "resultado").map(recordSlotIdentity));
  const rugbyFallback = verifiedRugbyResults2026.filter(record => !directResultSlots.has(recordSlotIdentity(record)));
  const { partidos, resultados } = mergeClubData(previous, [...officialRecords, ...rugbyFallback], instagramRecords);
  const output = {
    partidos,
    resultados,
    eventos: previous.eventos ?? [],
    actualizadoEn: new Date().toISOString(),
    diagnostico: { fuentes: sourceStatus, instagram: instagramStatus }
  };
  await fs.writeFile(dataPath, `${JSON.stringify(output, null, 2)}\n`);
  // Si se configuró Instagram pero Meta rechazó la conexión, el trabajo debe
  // quedar rojo. Así no confundimos una ejecución terminada con una lectura
  // correcta de los carruseles.
  if (process.env.INSTAGRAM_ACCESS_TOKEN && instagramStatus.estado === "error") {
    throw new Error(`Falló la conexión con Instagram: ${instagramStatus.detalle}`);
  }
}

export { categoriaDesdePlaca, expandApifyInstagramImages, extractInstagramStoryMentionImages, fetchLigaResultsWithScorers, mergeClubData, parse5022PublicContent, parseG22TeamApi, parseHockeyLine, parseInstagramImage, parseInstagramResultsBoard, parseLigaResultsApi, repairText, verifiedRugbyResults2026 };

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch(error => { console.error(error); process.exitCode = 1; });
