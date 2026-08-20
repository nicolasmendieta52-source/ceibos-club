const DEPORTES = new Set(["futbol", "rugby", "hockey", "basketball"]);
export const VENTANA_INICIO_MINUTOS = 4 * 60;

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
