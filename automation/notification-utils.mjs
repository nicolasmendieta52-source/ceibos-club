const DEPORTES = new Set(["futbol", "rugby", "hockey", "basketball"]);

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

export function detectarEventos(datosAnteriores, datosActuales, estado = {}, hoy = fechaMontevideo()) {
  const anteriores = new Set((datosAnteriores?.partidos || []).map(clavePartido));
  const enviadosNuevos = estado.sentNew || {};
  const enviadosHoy = estado.sentToday || {};
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

  return { nuevos, delDia };
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
  const campo = tipo === "today" ? "sentToday" : "sentNew";
  estado[campo] ||= {};
  partidos.forEach(partido => { estado[campo][clavePartido(partido)] = instante; });
  return estado;
}

export function podarEstado(estado, dias = 150, ahora = Date.now()) {
  const limite = ahora - dias * 24 * 60 * 60 * 1000;
  for (const campo of ["sentNew", "sentToday"]) {
    estado[campo] ||= {};
    for (const [clave, fecha] of Object.entries(estado[campo])) {
      if (!fecha || Date.parse(fecha) < limite) delete estado[campo][clave];
    }
  }
  return estado;
}
