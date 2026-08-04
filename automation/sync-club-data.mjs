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

function parseInstagramDate(value) {
  const match = clean(value).match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!match) return "";
  const year = Number(match[3] ?? now.getFullYear());
  return `${year}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
}

const sinAcentos = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

function deporteDesdePlaca(text) {
  const value = sinAcentos(text);
  if (value.includes("futbol")) return "futbol";
  if (value.includes("hockey")) return "hockey";
  if (value.includes("rugby")) return "rugby";
  if (value.includes("basket") || value.includes("basquet")) return "basketball";
  return "";
}

function categoriaDesdePlaca(text) {
  const value = sinAcentos(text);
  const categorias = [
    ["reserva verde", "Reserva Verde"], ["reserva a", "Reserva A"],
    ["primera", "Primera"], ["pre senior", "PreSenior"], ["presenior", "PreSenior"],
    ["sub 20", "Sub 20"], ["sub 18", "Sub 18"], ["intermedia a", "Intermedia A"],
    ["inter a", "Intermedia A"], ["intermedia b", "Intermedia B"], ["inter b", "Intermedia B"],
    ["intermedia c", "Intermedia C"], ["inter c", "Intermedia C"], ["reserva", "Reserva"]
  ];
  return categorias.find(([needle]) => value.includes(needle))?.[1] ?? "";
}

function parseInstagramImage(text, aliases) {
  const deporte = deporteDesdePlaca(text);
  const categoria = categoriaDesdePlaca(text);
  const dateMatch = text.match(/\b(\d{1,2})\s*[\/-]\s*(\d{1,2})(?:\s*[\/-]\s*(\d{2,4}))?\b/);
  if (!deporte || !categoria || !dateMatch) return [];
  const fecha = parseInstagramDate(`${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3] ?? now.getFullYear()}`);
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const result = [];
  const categoryPositions = lines
    .map((line, index) => ({ index, categoria: categoriaDesdePlaca(line) }))
    .filter(item => item.categoria);
  const blocks = categoryPositions.length ? categoryPositions : [{ index: 0, categoria }];
  for (const block of blocks) {
    const next = categoryPositions.find(item => item.index > block.index)?.index ?? lines.length;
    const fragment = lines.slice(block.index, Math.min(next, block.index + 5)).join(" ");
    const versus = fragment.match(/\b(?:vs\.?|v\.)\s*([^\d]{2,90}?)(?=\s+\d{1,2}:\d{2}|\s+cancha\b|$)/i);
    if (!versus) continue;
    const rival = clean(versus[1].replace(/\b(universitario|club)\s*$/i, "$1"));
    if (!rival || isTeam(rival, aliases)) continue;
    const hora = fragment.match(/\b(\d{1,2}:\d{2})\b/)?.[1] ?? "A confirmar";
    const local = !/cancha\s*:\s*[^.]*\b(visitante|rival)\b/i.test(fragment) && /cancha\s*:\s*[^.]*ceibos/i.test(fragment);
    const score = fragment.match(/\b(\d+)\s*[-–]\s*(\d+)\b/);
    if (score) {
      const scoreIndex = score.index ?? 0;
      const ceibosIndex = Math.min(...aliases
        .map(alias => sinAcentos(fragment).indexOf(sinAcentos(alias)))
        .filter(index => index >= 0));
      const ceibosFirst = !Number.isFinite(ceibosIndex) || ceibosIndex < scoreIndex;
      result.push({
        kind: "resultado", deporte, categoria: block.categoria, rival, fecha,
        gf: Number(ceibosFirst ? score[1] : score[2]), gc: Number(ceibosFirst ? score[2] : score[1])
      });
    } else {
      result.push({ kind: "partido", deporte, categoria: block.categoria, rival, fecha, hora, local });
    }
  }
  return result;
}

async function readInstagramPosts(aliases) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    console.log("instagram: sin token configurado; se omite la lectura de carruseles");
    return null;
  }
  const response = await fetch("https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url,children{id,media_type,media_url,thumbnail_url}&limit=10", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Instagram API respondió ${response.status}`);
  const payload = await response.json();
  const images = (payload.data ?? []).flatMap(post => {
    const items = post.media_type === "CAROUSEL_ALBUM" ? post.children?.data ?? [] : [post];
    return items.filter(item => item.media_type === "IMAGE" && (item.media_url || item.thumbnail_url));
  }).slice(0, 20);
  if (!images.length) return [];
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa+eng");
  const matches = [];
  try {
    for (const image of images) {
      const { data } = await worker.recognize(image.media_url ?? image.thumbnail_url);
      const imageMatches = parseInstagramImage(data.text, aliases);
      if (!imageMatches.length) {
        // Deja una muestra corta en Actions para poder adaptar el lector al
        // diseño real de las placas del club, sin exponer el token.
        console.log(`instagram OCR sin coincidencia: ${clean(data.text).slice(0, 220)}`);
      }
      matches.push(...imageMatches);
    }
  } finally {
    await worker.terminate();
  }
  console.log(`instagram: ${matches.length} próximos partidos encontrados leyendo ${images.length} imágenes`);
  return matches;
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
  try {
    const instagramMatches = await readInstagramPosts(config.teamAliases);
    if (instagramMatches) {
      gathered.push(...instagramMatches);
      fuentesActualizadas += 1;
    }
  } catch (error) {
    console.warn(`instagram: no se pudo actualizar (${error.message})`);
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
