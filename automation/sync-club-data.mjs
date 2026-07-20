import { load } from "cheerio";
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
  const year = now.getFullYear() + (month < now.getMonth() + 1 ? 1 : 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseLine(line, source, aliases) {
  const text = clean(line);
  if (!aliases.some(alias => text.toLocaleLowerCase("es").includes(alias.toLocaleLowerCase("es")))) return null;
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

async function fetchHtml(source) {
  const response = await fetch(source.url, { headers: { "user-agent": "CeibosClubFixtureBot/1.0 (contacto: info@ceibosclub.com)" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const html = await response.text();
  const $ = load(html);
  const rows = $("tr").map((_, row) => $(row).text()).get();
  return rows.length ? rows.join("\n") : $.text();
}

async function renderPage(source) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: "CeibosClubFixtureBot/1.0 (contacto: info@ceibosclub.com)" });
    await page.goto(source.url, { waitUntil: "networkidle", timeout: 60000 });
    return await page.locator("body").innerText();
  } finally {
    await browser.close();
  }
}

async function main() {
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  const previous = JSON.parse(await fs.readFile(dataPath, "utf8").catch(() => "{}"));
  const gathered = [];
  for (const source of config.sources) {
    try {
      const text = source.modo === "browser" ? await renderPage(source) : await fetchHtml(source);
      const matches = parseText(text, source, config.teamAliases);
      console.log(`${source.deporte}: ${matches.length} partidos encontrados`);
      gathered.push(...matches);
    } catch (error) {
      console.warn(`${source.deporte}: no se pudo actualizar (${error.message})`);
    }
  }
  const partidos = unique(gathered.filter(match => match.kind === "partido").map(({ kind, ...match }) => match), match => `${match.deporte}|${match.categoria}|${match.rival}|${match.fecha}|${match.hora}`);
  const resultados = unique(gathered.filter(match => match.kind === "resultado").map(({ kind, ...match }) => match), match => `${match.deporte}|${match.categoria}|${match.rival}|${match.fecha}|${match.gf}|${match.gc}`);
  const output = {
    partidos: partidos.length ? partidos : (previous.partidos ?? []),
    resultados: resultados.length ? resultados : (previous.resultados ?? []),
    eventos: previous.eventos ?? [],
    actualizadoEn: new Date().toISOString()
  };
  await fs.writeFile(dataPath, `${JSON.stringify(output, null, 2)}\n`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
