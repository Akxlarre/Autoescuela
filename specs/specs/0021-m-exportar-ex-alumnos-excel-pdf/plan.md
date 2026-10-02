# Plan 0021-m — Exportar la lista de Ex-Alumnos B a Excel y PDF

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-10-02
> **Talla:** S

> Aprobación: el owner pidió implementar la función el 2026-10-02 ("hagamos el exportar"). La
> parte de PDF depende de la decisión D1 de la spec.

---

## 1. Resumen ejecutivo

El Dumb `app-ex-alumnos-content` ya tiene las filas filtradas (`filteredEgresados`). Al pulsar
"Exportar" emite el formato y esas filas; el Smart se las pasa a `ExAlumnosFacade.exportEgresados()`,
que arma la tabla con una función pura. El Excel se descarga ahí mismo; para el PDF envía esa
tabla a la Edge Function `export-table-pdf`, que solo la dibuja (D1). No hay consulta nueva: lo
exportado es, por construcción, lo que se ve.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/core/utils/egresados-export.utils.ts` (+ spec) | Util puro | `buildEgresadosExcelTable(rows)` y `buildEgresadosPdfTable(rows)`: cabeceras y celdas. AC2–AC6, AC-E2 |
| `src/app/shared/components/export-menu/export-menu.component.ts` | Dumb | Botón "Exportar" + menú Excel/PDF. Inputs `exporting`, `disabled`, `llmPrefix`; output `exportRequested`. AC1, AC7, AC-E1 |
| `supabase/functions/_shared/table-pdf.ts` (+ test Deno) | Util de Edge Function | `buildTablePdf(...)`: tabla A4 apaisada, paginada, con `pdf-lib`. AC3 |
| `supabase/functions/export-table-pdf/index.ts` | Edge Function | Valida la sesión y el cuerpo, y devuelve el PDF de la tabla recibida. AC3 |
| `src/app/core/utils/file-download.utils.ts` (+ spec) | Util | `downloadBlob(blob, filename)` |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/facades/ex-alumnos.facade.ts` (+ spec) | `isExporting` + `exportEgresados(format, rows)` | AC2, AC3, AC7, AC-E3 |
| `src/app/shared/components/ex-alumnos-content/ex-alumnos-content.component.ts` (+ spec) | `<app-export-menu>` en la barra; input `isExporting`; output `exportRequested` con las filas filtradas | AC1, AC4, AC-E1 |
| `src/app/features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts` | Cablear input/output | AC8 |
| `src/app/features/secretaria/ex-alumnos/secretaria-ex-alumnos.component.ts` | Cablear input/output | AC8 |
| `e2e/alumnos-b-ficha.spec.ts` | Caso T14: Excel real, PDF con la función simulada, botón deshabilitado | AC2–AC4, AC-E1 |
| `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` | Reemplaza su menú propio por `<app-export-menu>` (D2) | AC1 |

---

## 3. Reutilización (Discovery)

- `downloadExcel()` — `core/utils/excel.utils.ts`.
- `formatDayMonthYear()` — `core/utils/date.utils.ts`.
- Diseño del menú "Exportar" de `app-alumnos-list-content`. Hoy está copiado en 7 componentes;
  se extrae a `app-export-menu` y se usa aquí. Migrar los otros queda fuera de alcance.

---

## 4. Modelo de datos

N/A.

---

## 6. Restricciones aplicables

- [x] `architecture.md` — el Dumb no inyecta Facades; la lógica de armado es una función pura
- [x] `facades.md` — el Facade expone `isExporting` y captura el error
- [x] `visual-system.md` — `app-icon`, tokens, spinner `loader-circle`
- [x] `testing-tdd.md` — spec del util primero
- [x] `ai-readability.md` — `data-llm-action` en botón y opciones

---

## 7. Plan de testing

- Unitarios: util de armado, facade, componente.
- E2E: descarga del Excel y comparación con la pantalla; PDF: cabecera `%PDF` y nombre.
- Visual: barra de la tabla a 1600 px, tarjetas a 1280 y 375 px, modo oscuro.

---

## 9. Orden de implementación

1. Util de armado + spec
2. `app-export-menu`
3. Facade (Excel) + spec
4. Componente + Smarts
5. E2E Excel + verificación visual
6. PDF según D1
7. Cierre

---

## Changelog

- 2026-10-02 — plan inicial
