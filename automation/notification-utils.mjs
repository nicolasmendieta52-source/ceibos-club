const DEPORTES = new Set(["futbol", "rugby", "hockey", "basketball"]);
export const VENTANA_INICIO_MINUTOS = 4 * 60;
export const PREPARACION_INICIO_MINUTOS = 5;

export function normalizar(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function deporteValido(valor) {
  const deporte = normalizar(valor).replace(/\s+/g, "");
  return DEPORTES.has(deporte) ? deporte : "";
}

export function clavePartido(partido) {
  return [
    deporteValido(partido?.deporte),
    normalizar(partido?.categoria),
    normalizar(partido?.rival),
    String(partido?.fecha || "")
  ].join("|");
}

export function fechaMontevideo(fecha = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat("en", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(fecha).filter(parte => parte.type !== "literal").map(parte => [parte.type, parte.value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}

export function horaMontevideo(fecha = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat("en", {
    timeZone: "America/Montevideo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(fecha).filter(parte => parte.type !== "literal").map(parte => [parte.type, parte.value]));
  return Number(partes.hour) * 60 + Number(partes.minute);
}

function fechaAnteriorISO(fechaISO) {
  const coincidencia = String(fechaISO || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!coincidencia) return "";
  const fecha = new Date(Date.UTC(Number(coincidencia[1]), Number(coincidencia[2]) - 1, Number(coincidencia[3]) - 1));
  return fecha.toISOString().slice(0, 10);
}

export function minutosDesdeInicio(partido, ahora = new Date(), hoy = fechaMontevideo(ahora)) {
  const coincidencia = String(partido?.hora || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!coincidencia) return null;
  const minutoPartido = Number(coincidencia[1]) * 60 + Number(coincidencia[2]);
  if (partido?.fecha === hoy) return horaMontevideo(ahora) - minutoPartido;
  if (partido?.fecha === fechaAnteriorISO(hoy)) return horaMontevideo(ahora) + 24 * 60 - minutoPartido;
  return null;
}

// Resolve the fixture's local wall clock through the IANA timezone, including midnight.
export function instanteInicio(partido) {
  const fecha = String(partido?.fecha || '');
  const hora = String(partido?.hora || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !hora || Number(hora[1]) > 23 || Number(hora[2]) > 59) return null;
  const local = `${fecha}T${hora[1].padStart(2, '0')}:${hora[2]}:00.000Z`;
  const naive = Date.parse(local);
  if (!Number.isFinite(naive) || new Date(naive).toISOString() !== local) return null;
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Montevideo', year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
  });
  const parts = Object.fromEntries(formatter.formatToParts(naive).map(p => [p.type, p.value]));
  const rendered = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return naive + (naive - rendered);
}

export function planificarInicios(datos, estado = {}, ahora = Date.now(), hasta = ahora + 180 * 60_000) {
  const groups = new Map();
  for (const partido of datos?.partidos || []) {
    const deporte = deporteValido(partido.deporte);
    const inicio = instanteInicio(partido);
    const clave = clavePartido(partido);
    if (!deporte || inicio === null || inicio > hasta || ahora - inicio >= VENTANA_INICIO_MINUTOS * 60_000 || estado.sentStart?.[clave]) continue;
    if (/cancelad|suspendid|postergad|aplazad/.test(normalizar(partido.estado))) continue;
    const id = `${deporte}|${inicio}`;
    if (!groups.has(id)) groups.set(id, {id, deporte, inicio, preparar:inicio - PREPARACION_INICIO_MINUTOS * 60_000, partidos:[]});
    const group = groups.get(id);
    if (!group.partidos.some(p => clavePartido(p) === clave)) group.partidos.push(partido);
  }
  return [...groups.values()].sort((a,b) => a.inicio - b.inicio);
}

export function detectarEventos(datosAnteriores, datosActuales, estado = {}, hoy = fechaMontevideo(), ahora = new Date(), ventanaInicio = VENTANA_INICIO_MINUTOS) {
  const anteriores = new Set((datosAnteriores?.partidos || []).map(clavePartido));
  const enviadosNuevos = estado.sentNew || {};
  const enviadosHoy = estado.sentToday || {};
  const enviadosInicio = estado.sentStart || {};
  const partidos = (datosActuales?.partidos || []).filter(partido => {
    return deporteValido(partido.deporte) && /^\d{4}-\d{2}-\d{2}$/.test(String(partido.fecha || ""));
  });

  const nuevos = partidos.filter(partido => {
    const clave = clavePartido(partido);
    return partido.fecha >= hoy && !anteriores.has(clave) && !enviadosNuevos[clave];
  });
  const delDia = partidos.filter(partido => {
    const clave = clavePartido(partido);
    return partido.fecha === hoy && !enviadosHoy[clave];
  });
  const inician = partidos.filter(partido => {
    const clave = clavePartido(partido);
    if (enviadosInicio[clave]) return false;
    const transcurridos = minutosDesdeInicio(partido, ahora, hoy);
    if (transcurridos === null) return false;
    return transcurridos >= 0 && transcurridos < ventanaInicio;
  });

  return { nuevos, delDia, inician };
}

export function agruparPorDeporte(partidos) {
  return partidos.reduce((grupos, partido) => {
    const deporte = deporteValido(partido.deporte);
    if (!deporte) return grupos;
    if (!grupos.has(deporte)) grupos.set(deporte, []);
    grupos.get(deporte).push(partido);
    return grupos;
  }, new Map());
}

export function marcarEnviados(estado, tipo, partidos, instante = new Date().toISOString()) {
  const campo = tipo === "today" ? "sentToday" : tipo === "start" ? "sentStart" : "sentNew";
  estado[campo] ||= {};
  partidos.forEach(partido => { estado[campo][clavePartido(partido)] = instante; });
  return estado;
}

export function podarEstado(estado, dias = 150, ahora = Date.now()) {
  const limite = ahora - dias * 24 * 60 * 60 * 1000;
  for (const campo of ["sentNew", "sentToday", "sentStart"]) {
    estado[campo] ||= {};
    for (const [clave, fecha] of Object.entries(estado[campo])) {
      if (!fecha || Date.parse(fecha) < limite) delete estado[campo][clave];
    }
  }
  return estado;
}
