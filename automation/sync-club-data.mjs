import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(directory, "../data/club-data.json");
const configPath = path.resolve(directory, "fuentes.json");
const ocrCachePath = path.resolve(directory, "../data/instagram-ocr-cache.json");
const now = new Date();
const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();

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

async function readInstagramPosts(aliases) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    console.log("instagram: sin token configurado; se omite la lectura de carruseles");
    return null;
  }
  // Pedimos solamente los campos del post. Las imágenes internas de cada
  // carrusel se consultan después mediante /children. Meta rechaza en algunas
  // versiones la expansión anidada children{...} dentro de /me/media.
  const payload = await instagramRequest("/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,timestamp&limit=40", token);
  // Los fixtures actuales se publican desde la cuenta principal invitando a
  // ceibosfutbol como colaborador. /me/media devuelve solamente publicaciones
  // propias, por lo que consultamos también el borde de contenido colaborativo.
  let collaborativePosts = [];
  try {
    collaborativePosts = (await instagramRequest("/me/collaborative_media?fields=id,media_type,media_url,thumbnail_url,permalink,timestamp&limit=40", token)).data ?? [];
    console.log(`instagram: ${collaborativePosts.length} publicaciones colaborativas para revisar`);
  } catch (error) {
    console.log(`instagram: las publicaciones colaborativas no están disponibles (${error.message})`);
  }
  // Los resultados se suelen compartir en historias. Cuando el token permite
  // leerlas, también analizamos las que siguen activas (24 horas). Para el
  // historial, los carruseles publicados continúan siendo la fuente estable.
  let stories = [];
  try {
    stories = (await instagramRequest("/me/stories?fields=id,media_type,media_url,thumbnail_url,timestamp&limit=25", token)).data ?? [];
    console.log(`instagram: ${stories.length} historias activas para revisar`);
  } catch {
    console.log("instagram: las historias activas no están disponibles; se leen los carruseles publicados");
  }

  const maxImages = Math.max(10, Number(process.env.INSTAGRAM_OCR_MAX_IMAGES ?? 70));
  const expanded = await expandInstagramImages([...(payload.data ?? []), ...collaborativePosts, ...stories], token);
  const images = [...new Map(expanded.map(image => [image.id, image])).values()].slice(0, maxImages);
  if (!images.length) return { matches: [], imagesRead: 0, recognized: 0, cached: 0 };

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
  console.log(`instagram: ${partidos} partidos y ${resultados} resultados encontrados en ${images.length} imágenes (${collaborativePosts.length} publicaciones colaborativas, ${cached} desde caché, ${recognized} nuevas, ${sparseFallbacks} con segunda lectura)`);
  return { matches, imagesRead: images.length, recognized, cached, collaborative: collaborativePosts.length };
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
    return { deporte, categoria, rival, gf, gc, fecha, _priority: priority };
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
  const priorPartidos = (previous.partidos ?? [])
    .filter(record => !replaceUpcoming.has(`${comparable(record.deporte)}|${comparable(record.categoria)}`) || officialUpcoming.has(recordIdentity(record)))
    .map(record => ({ ...record, _priority: 0 }));
  const officialPartidos = officialRecords.filter(record => record.kind === "partido").map(record => ({ ...record, _priority: 2 }));
  const instagramPartidos = instagramRecords.filter(record => record.kind === "partido").map(record => ({ ...record, _priority: 1 }));
  const officialResultados = officialRecords.filter(record => record.kind === "resultado").map(record => ({ ...record, _priority: 2 }));
  const instagramResultados = instagramRecords.filter(record => record.kind === "resultado").map(record => ({ ...record, _priority: 1 }));
  const priorResultados = (previous.resultados ?? []).map(record => ({ ...record, _priority: 0 }));
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
      // Todas las fuentes configuradas requieren JavaScript para mostrar el
      // fixture. Usamos siempre Chromium para leer la misma tabla oficial que
      // ve una persona y evitamos depender de parsers HTML adicionales.
      const text = await renderPage(source);
      const matches = parseText(text, source, config.teamAliases);
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
      instagramStatus = { estado: instagram.matches.length ? "ok" : "sin-coincidencias", registros: instagram.matches.length, imagenes: instagram.imagesRead, colaboraciones: instagram.collaborative, cache: instagram.cached, nuevas: instagram.recognized };
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
  const { partidos, resultados } = mergeClubData(previous, officialRecords, instagramRecords);
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

export { categoriaDesdePlaca, mergeClubData, parseInstagramImage, parseInstagramResultsBoard, repairText };

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch(error => { console.error(error); process.exitCode = 1; });
