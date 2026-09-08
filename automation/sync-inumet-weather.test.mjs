import test from "node:test";
import assert from "node:assert/strict";
import { construirClimaInumet, sumarDiasISO } from "./sync-inumet-weather.mjs";

test("suma días sin depender de la zona horaria del runner", () => {
  assert.equal(sumarDiasISO("2026-09-08", 4), "2026-09-12");
});

test("conserva únicamente el pronóstico metropolitano oficial", () => {
  const clima = construirClimaInumet({
    fechaPublicacion: "2026-09-08 12:00",
    inicioPronostico: "2026-09-08",
    items: [
      { zonaCorta: "E", diaMasN: 0, tempMin: 2, tempMax: 15 },
      {
        zonaCorta: "M", zonaLarga: "Área Metropolitana", diaMasN: 1,
        grupo: "Miércoles 09", tempMin: 5, tempMax: 17,
        subgrupos: [{ orden: 2, subgrupo: "Tarde/Noche", descripcion: "Nuboso.", vientos: "NE 10-20 km/h." }]
      }
    ]
  }, "2026-09-08T15:30:00.000Z");

  assert.equal(clima.pronosticos.length, 1);
  assert.equal(clima.pronosticos[0].fecha, "2026-09-09");
  assert.equal(clima.pronosticos[0].temperaturaMax, 17);
  assert.equal(clima.pronosticos[0].periodos[0].nombre, "Tarde/Noche");
  assert.equal(clima.zona, "Área Metropolitana");
});

test("rechaza respuestas sin datos metropolitanos", () => {
  assert.throws(
    () => construirClimaInumet({ inicioPronostico: "2026-09-08", items: [] }),
    /Área Metropolitana/
  );
});
