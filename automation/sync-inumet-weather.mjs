import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const INUMET_FORECAST_URL = "https://www.inumet.gub.uy/reportes/pronosticos/pronosticoV4.json";

const normalizarPeriodo = periodo => ({
  orden: Number(periodo?.orden) || 0,
  nombre: String(periodo?.subgrupo || "").trim(),
  descripcion: String(periodo?.descripcion || "").trim(),
  evolucion: String(periodo?.evolucion || "").trim(),
  detalle: String(periodo?.descripcionExtra || "").trim(),
  viento: String(periodo?.vientos || "").trim()
});

export function sumarDiasISO(fechaISO, cantidad) {
  const [anio, mes, dia] = String(fechaISO).split("-").map(Number);
  if (!anio || !mes || !dia) throw new Error("INUMET no informó una fecha inicial válida");
  const fecha = new Date(Date.UTC(anio, mes - 1, dia + Number(cantidad || 0)));
  return fecha.toISOString().slice(0, 10);
}

export function construirClimaInumet(datos, fetchedAt = new Date().toISOString()) {
  if (!datos || !Array.isArray(datos.items)) throw new Error("La respuesta de INUMET no contiene pronósticos");
  const inicio = String(datos.inicioPronostico || "").slice(0, 10);
  const pronosticos = datos.items
    .filter(item => item?.zonaCorta === "M")
    .map(item => ({
      fecha: sumarDiasISO(inicio, item.diaMasN),
      diaMasN: Number(item.diaMasN) || 0,
      etiqueta: String(item.grupo || item.grupoCorto || "").trim(),
      temperaturaMin: Number.isFinite(Number(item.tempMin)) ? Number(item.tempMin) : null,
      temperaturaMax: Number.isFinite(Number(item.tempMax)) ? Number(item.tempMax) : null,
      probabilidadLluvia: String(item.probLluvia || "").trim(),
      periodos: Array.isArray(item.subgrupos)
        ? item.subgrupos.map(normalizarPeriodo).sort((a, b) => a.orden - b.orden)
        : []
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (!pronosticos.length) throw new Error("INUMET no publicó el pronóstico para el Área Metropolitana");

  return {
    fuente: "INUMET",
    fuenteUrl: "https://www.inumet.gub.uy/",
    datosUrl: INUMET_FORECAST_URL,
    zona: "Área Metropolitana",
    ubicacion: "Zona del predio Los Ceibos",
    estacionReferencia: "Melilla - Aeropuerto Internacional Ángel S. Adami",
    publicado: String(datos.fechaPublicacion || "").trim(),
    actualizado: fetchedAt,
    pronosticos
  };
}

export async function sincronizarClimaInumet({ fetchImpl = fetch, destino } = {}) {
  const respuesta = await fetchImpl(INUMET_FORECAST_URL, {
    headers: { Accept: "application/json", "User-Agent": "CeibosClubWeb/1.0" },
    signal: AbortSignal.timeout(30000)
  });
  if (!respuesta.ok) throw new Error(`INUMET respondió ${respuesta.status}`);
  const clima = construirClimaInumet(await respuesta.json());
  if (destino) await fs.writeFile(destino, `${JSON.stringify(clima, null, 2)}\n`, "utf8");
  return clima;
}

const ejecutadoDirectamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (ejecutadoDirectamente) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const destino = path.join(raiz, "data", "inumet-weather.json");
  try {
    const clima = await sincronizarClimaInumet({ destino });
    console.log(`INUMET: ${clima.pronosticos.length} pronósticos del Área Metropolitana guardados`);
  } catch (error) {
    console.error(`INUMET: no se pudo actualizar el clima (${error.message})`);
    process.exitCode = 1;
  }
}
