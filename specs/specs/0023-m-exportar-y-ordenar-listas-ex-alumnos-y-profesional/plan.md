# Plan 0023-m — Exportar y ordenar por columna en Ex-Alumnos B, Base de Alumnos Profesional y Ex-Alumnos Profesional

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (Matías, 2026-10-02 — talla M)
> **Created:** 2026-10-02

---

## 1. Resumen ejecutivo

Se extrae a piezas compartidas lo que hoy vive solo en la Base de Alumnos B (lógica de orden,
botón de título ordenable y control "Ordenar por" de tarjetas) y se aplica a las tres listas.
La exportación replica el esquema de `0021-m`: la lista emite sus filas, una util arma las
tablas y el Facade genera el Excel en el navegador o el PDF con `export-table-pdf`.

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `core/utils/table-sort.utils.ts` (+ spec) | Util pura | `sortRows`, `nextSort`, `toggleSortDirection`, `ariaSortOf` genéricos (los de 0020-m, sin atarse a la Base B) |
| `core/utils/egresados-sort.utils.ts` (+ spec) | Util pura | Columnas y claves de orden de Ex-Alumnos (B y Profesional) |
| `core/utils/alumnos-profesional-sort.utils.ts` (+ spec) | Util pura | Columnas y claves de orden de la Base Profesional |
| `core/utils/alumnos-profesional-export.utils.ts` (+ spec) | Util pura | Tablas Excel/PDF de la Base Profesional |
| `shared/components/sort-header/sort-header.component.ts` | Dumb | Botón del título de columna (texto + flecha); el CSS que hoy está en alumnos-list-content |
| `shared/components/sort-control/sort-control.component.ts` | Dumb | "Ordenar por" + botón de sentido para la vista de tarjetas |

### Archivos a MODIFICAR

| Path | Cambio |
|------|--------|
| `core/utils/alumnos-sort.utils.ts` | Pasa a usar `table-sort.utils` (mismas exports, mismo comportamiento) |
| `shared/components/alumnos-list-content/…` | Usa `app-sort-header` y `app-sort-control` (sin cambiar comportamiento) |
| `shared/components/ex-alumnos-content/…` | Orden por columna + "Ordenar por"; exporta filas ordenadas |
| `shared/components/alumnos-profesional-list-content/…` | Orden + `app-export-menu` + output `exportRequested` |
| `shared/components/ex-alumnos-profesional-content/…` | Orden + `app-export-menu` + output `exportRequested` |
| `core/facades/admin-alumnos-profesional.facade.ts` | `isExporting` + `exportAlumnos(format, rows)` |
| `core/facades/ex-alumnos.facade.ts` | `exportEgresados` acepta el grupo (B / Profesional): título, nombre de archivo y etiqueta de columna |
| `core/utils/egresados-export.utils.ts` | Etiqueta "Nº Expediente" / "Nº Matrícula" según grupo |
| `features/{admin,secretaria}/alumnos-profesional/…`, `features/{admin,secretaria}/ex-alumnos-profesional/…` | Conectan `exportRequested` y `isExporting` |
| `indices/COMPONENTS.md`, `indices/UTILS.md` | Registrar piezas nuevas |

## 3. Reutilización

- `app-export-menu`, `downloadExcel`, `downloadBlob`, `export-table-pdf`, `ExportTable`.
- Lógica de orden de `0020-m` (`sortAlumnos`, `nextAlumnoSort`…) — se generaliza, no se duplica.

## 4. Modelo de datos

N/A.

## 5. Arquitectura

```
Lista (Organismo) ─ sort signal ─ sortRows(filtradas, sort, claveDeLaLista) ─► tabla / tarjetas
   │  <app-sort-header> en cada <th> · <app-sort-control> en tarjetas
   └─ exportRequested { format, rows: ordenadas } ─► Smart ─► Facade.export…()
                                                         ├─ Excel: build…ExcelTable + downloadExcel
                                                         └─ PDF: build…PdfTable + export-table-pdf
```

## 6. Restricciones aplicables

- [x] Functional Core en `core/utils/` con tests · [x] Dumb sin Facades · [x] OnPush, `input()`/`output()`
- [x] `data-llm-action` en botones nuevos · [x] Tokens del DS · [ ] BD / RLS

## 7. Testing

- Specs de las utils nuevas (orden: asc/desc, sin dato al final, empates estables; export:
  columnas y valores = pantalla).
- `alumnos-sort.utils.spec.ts` existente sigue verde sin cambios (AC-E2).
- Tests de componente: exportar emite las filas ordenadas; clic en título cicla el orden.
- `ng build`, `npm run test:ci`, `npm run lint:arch`, `/verify` de las tres listas.

## 8. Riesgos

- Refactor de la Base B al componente compartido: cubierto por sus tests de 0020-m y la E2E.
- Ex-Alumnos Profesional está oculta: se verifica entrando por URL.

## 9. Orden

1. `table-sort.utils` + migrar `alumnos-sort.utils` (tests verdes).
2. `app-sort-header`, `app-sort-control`; migrar Base B.
3. Ex-Alumnos B (orden).
4. Base Profesional (orden + export).
5. Ex-Alumnos Profesional (orden + export).
6. Validación + índices.
