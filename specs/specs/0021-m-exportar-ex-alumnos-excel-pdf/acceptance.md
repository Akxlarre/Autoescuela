# Acceptance 0021-m — Exportar la lista de Ex-Alumnos B a Excel y PDF

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-10-02
> **Verifier:** Claude (tests + navegador) · visto bueno visual de Matías (2026-10-02)

---

## Resumen

- AC totales: 11 (8 + 3 edge cases)
- Verificados de punta a punta: 11
- **AC3 (PDF) contra la función desplegada:** exportado desde `/app/admin/ex-alumnos` (16 filas
  enviadas, 16 en pantalla) y `/app/secretaria/ex-alumnos` (8 y 8). Respuesta 200
  `application/pdf`, archivo `ex-alumnos-b_2026-10-02.pdf`, consola sin errores. El PDF se abrió y
  se revisó: título, "Generado · Página 1 de 1", 7 columnas, filas en el orden de la pantalla,
  "Debe $180.000" / "Al día", "Total: 16 egresados".

**Veredicto:** ✅ PASA — 11/11 AC y visto bueno visual del owner (2026-10-02).

Evidencia:

- `utils` = `src/app/core/utils/egresados-export.utils.spec.ts`
- `facade` = `src/app/core/facades/ex-alumnos.facade.spec.ts` ("exportEgresados — spec 0021-m")
- `comp` = `src/app/shared/components/ex-alumnos-content/ex-alumnos-content.component.spec.ts`
- `deno` = `supabase/functions/_shared/table-pdf.test.ts`
- `e2e` = `e2e/alumnos-b-ficha.spec.ts`, bloque "T14 (spec 0021-m): exportar la lista"

| AC | Estado | Evidencia |
|---|---|---|
| AC1 — botón "Exportar" con Excel y PDF | ✅ | Capturas a 1600 px (claro y oscuro) y 375 px; `e2e` |
| AC2 — Excel con las 9 columnas | ✅ | `e2e` (descarga y lee el .xlsx); `utils`; `facade` |
| AC3 — PDF con título, fecha, total y tabla paginada | ✅ | Prueba contra la función desplegada (ver Resumen); `deno` (11 casos) + PDF de muestra de 34 filas (2 páginas) revisado; `facade`; `e2e` con la función simulada |
| AC4 — mismas filas que la pantalla, todas las páginas | ✅ | `comp` ("no se limita a la página visible"); `e2e` |
| AC5 — fecha de egreso dd-mm-aaaa | ✅ | `utils`; `e2e` |
| AC6 — "Al día" / "Debe" + saldo | ✅ | `utils`; `e2e` |
| AC7 — indicador de carga y sin doble pulsación | ✅ | `facade` ("isExporting…", "una segunda exportación… se ignora") |
| AC8 — admin y secretaria | ✅ | Ambos Smarts cableados; `e2e` con secretaria; capturas con admin |
| AC-E1 — sin filas, botón deshabilitado | ✅ | `e2e` |
| AC-E2 — sin Nº de expediente ni fecha | ✅ | `utils` |
| AC-E3 — fallo → aviso y botón disponible | ✅ | `facade` |

### Corridas (2026-10-02)

- `npx vitest run` → 3020 pasan, 5 omitidos.
- `deno test supabase/functions/_shared/table-pdf.test.ts` → 11/11.
- `npm run lint:arch` → 0 errores, 178 avisos (igual que antes).
- E2E: los 3 tests de T14 pasan. Corriendo juntos los dos archivos de Alumnos B (64 tests) hubo
  1 fallo por tiempo de espera en cada una de dos corridas, en tests distintos y ajenos a esta
  spec ("Ordenar por" en tarjetas; reprogramar clase); ambos pasan al correrlos solos.

### Base de Alumnos (D2)

El menú "Exportar" ahora es `app-export-menu`. Mismos textos, mismos `data-llm-action`
(`open-export-menu`, `export-students-excel`, `export-students-pdf`), misma altura y tamaño de
letra (47 px, 14 px, medidos en ambas pantallas). Único cambio visible: la sombra del menú usa el
token `--shadow-lg` en vez de un valor escrito a mano (queda algo más suave).

---

## Out-of-scope respetado

- ❌ Ex-Alumnos Profesional — no se tocó.
- ❌ Certificado desde la lista — no entró.
- ❌ Exportación de la Base de Alumnos (bug B1) — no se tocó `export-students`.
- ❌ Otros menús "Exportar" (contabilidad, auditoría) — siguen con su copia propia.

---

## Firma de cierre

- [x] Índices actualizados
- [x] Tests pasando
- [x] `lint:arch` sin errores
- [x] Función `export-table-pdf` desplegada y PDF probado de punta a punta
- [x] Visto bueno visual del owner — Matías, 2026-10-02 (menú y ambos archivos descargados)
