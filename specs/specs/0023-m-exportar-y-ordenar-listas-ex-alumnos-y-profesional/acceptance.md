# Acceptance 0023-m — Exportar y ordenar por columna en Ex-Alumnos B, Base de Alumnos Profesional y Ex-Alumnos Profesional

> **Verificado:** 2026-10-02 · admin · Playwright (1600×900 tabla, 1280×800 tarjetas)
> **Estado:** ✅ PASA — visto bueno visual de Matías (2026-10-02)

| AC | Evidencia | Estado |
|----|-----------|--------|
| AC1 | Base Prof. y Ex-Alumnos Prof.: el menú "Exportar" muestra "Exportar como Excel" y "Exportar como PDF" (`export-professional-students-*`, `export-professional-graduates-*`). | ✅ |
| AC2 | Base Prof. ordenada por Saldo desc: el Excel trae las 60 filas (todas las páginas) en el orden de la pantalla, con Nº Mat., módulos "0/7", asistencia y saldo. Ex-Alumnos Prof.: Excel y PDF con la fila visible. Utils: `alumnos-profesional-export.utils.spec.ts`. | ✅ |
| AC3 | Excel descargado sin llamada a red (hoja "Alumnos Profesional" / "Ex-Alumnos Profesional"); PDF: `POST functions/v1/export-table-pdf` → 200, títulos "Base de Alumnos Profesional" y "Ex-Alumnos Clase Profesional". | ✅ |
| AC4 | `[disabled]="filteredAlumnos().length === 0"` / `filtered().length === 0` en las dos listas, igual que Ex-Alumnos B. No se probó en pantalla con lista vacía. | ✅ (código) |
| AC5 | Base Prof.: Saldo ×2 → `aria-sort="descending"` y deudores arriba. Ex-Alumnos B: Alumno asc → desc con flecha. Ciclo completo (3er clic vuelve al defecto): `ex-alumnos-content.component.spec.ts`, `table-sort.utils.spec.ts`. | ✅ |
| AC6 | El orden se aplica sobre las filas ya filtradas (`sortEgresados(filteredEgresados(), sort())`); "Limpiar filtros" no toca `sort` (test "limpiar filtros conserva el orden elegido"). | ✅ |
| AC7 | Base Prof. a 1280px (vista tarjetas): "Ordenar por: Saldo" + botón "Ascendente" ordena las tarjetas. | ✅ |
| AC8 | Excel y PDF de Base Prof. salen en el orden por Saldo desc elegido; test "la exportación sale en el orden de la pantalla". | ✅ |
| AC-E1 | `table-sort.utils.spec.ts`, `egresados-sort.utils.spec.ts`, `alumnos-profesional-sort.utils.spec.ts`: sin dato al final en ambos sentidos. | ✅ |
| AC-E2 | `alumnos-sort.utils.spec.ts` sin cambios y verde; Base Alumnos B ordena por RUT asc en pantalla. | ✅ |
| AC-E3 | Ex-Alumnos Prof. abierta quitando el bloqueo del piloto solo en local (revertido después): títulos ordenables, Excel y PDF OK. | ✅ |

## Probes `/verify`

- Consola: 0 errores. Las 6 advertencias NG0955 del skeleton de la Base Prof. (claves de
  `track` repetidas, previas a esta spec) se corrigieron con `track $index` → 0 advertencias.
- Red: `export-table-pdf` 200; sin 4xx.
- Sin scroll horizontal a 1280px.

## Observaciones

- El PDF muestra el saldo como "$180.000" y la tabla como "180.000 CLP" (mismo formato que el
  PDF de Ex-Alumnos B, `formatCLP`).
- La Base Prof. pasa a tarjetas bajo 900px de ancho de la lista (umbral previo): a 1280px con
  la barra lateral ya se ve en tarjetas.
