import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(directory, "../data/club-data.json");
const configPath = path.resolve(directory, "fuentes.json");
const now = new Date();
const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
const unique = (items, key) => [...new Map(items.map(item => [key(item), item])).values()];

function dateFromDayMonth(day, month) {
  const year = now.getFullYear();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isTeam(value, aliases) {
  return aliases.some(alias => clean(value).toLocaleLowerCase("es") === alias.toLocaleLowerCase("es"));
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
  return { kind: "partido", deporte: source.deporte, categoria: source.categoria, rival: local ? away : home, fecha, hora: date[3], local };
}

function parseLine(line, source, aliases) {
  if (source.formato === "hockey-admin") return parseHockeyLine(line, source, aliases);
  const raw = String(line);
  const cells = raw.split("\t").map(clean).filter(Boolean);
  const text = clean(raw);
  if (!aliases.some(alias => text.toLocaleLowerCase("es").includes(alias.toLocaleLowerCase("es")))) return null;

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
    return { kind: "partido", deporte: source.deporte, categoria: source.categoria, rival: local ? away : home, fecha: cells[0].slice(0, 10), hora: cells[0].slice(11, 16) === "00:00" ? "A confirmar" : cells[0].slice(11, 16), local };
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

async function renderPage(source) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: "CeibosClubFixtureBot/1.0 (contacto: info@ceibosclub.com)" });
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
      if (await fixtureTab.count()) {
        await fixtureTab.click();
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
    await browser.close();
  }
}

async function main() {
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  const previous = JSON.parse(await fs.readFile(dataPath, "utf8").catch(() => "{}"));
  const gathered = [];
  let fuentesActualizadas = 0;
  for (const source of config.sources) {
    try {
      // Todas las fuentes configuradas requieren JavaScript para mostrar el
      // fixture. Usamos siempre Chromium para leer la misma tabla oficial que
      // ve una persona y evitamos depender de parsers HTML adicionales.
      const text = await renderPage(source);
      const matches = parseText(text, source, config.teamAliases);
      console.log(`${source.deporte}: ${matches.length} partidos encontrados`);
      gathered.push(...matches);
      fuentesActualizadas += 1;
    } catch (error) {
      console.warn(`${source.deporte}: no se pudo actualizar (${error.message})`);
    }
  }
  // Si ninguna fuente respondió, no tocamos el JSON existente ni marcamos el
  // trabajo como exitoso. GitHub Actions debe avisar el fallo para no dejar un
  // fixture aparentemente actualizado pero con información vieja.
  if (fuentesActualizadas === 0) {
    throw new Error("No se pudo actualizar ninguna fuente oficial. Se conservaron los datos anteriores.");
  }
  // Una fuente puede no responder momentáneamente. Conservamos los datos que
  // ya estaban publicados y sumamos los nuevos, para que un deporte nunca
  // borre los resultados de los demás.
  const nuevosPartidos = gathered.filter(match => match.kind === "partido").map(({ kind, ...match }) => match);
  const nuevosResultados = gathered.filter(match => match.kind === "resultado").map(({ kind, ...match }) => match);
  const partidos = unique([...nuevosPartidos, ...(previous.partidos ?? [])], match => `${match.deporte}|${match.categoria}|${match.rival}|${match.fecha}|${match.hora}`);
  const resultados = unique([...nuevosResultados, ...(previous.resultados ?? [])], match => `${match.deporte}|${match.categoria}|${match.rival}|${match.fecha}`);
  const output = {
    partidos,
    resultados,
    eventos: previous.eventos ?? [],
    actualizadoEn: new Date().toISOString()
  };
  await fs.writeFile(dataPath, `${JSON.stringify(output, null, 2)}\n`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
