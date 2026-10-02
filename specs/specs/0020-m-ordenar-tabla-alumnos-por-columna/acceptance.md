# Acceptance 0020-m — Ordenar la tabla de la Base de Alumnos B por columna

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-10-02
> **Verifier:** Claude (tests + navegador) · visto bueno visual de Matías (2026-10-02)

---

## Resumen

- AC totales: 14 (11 + 3 edge cases)
- AC cumplidos con evidencia automática: 14
- Visto bueno visual del owner: dado el 2026-10-02 (confirma las decisiones D1 y D2)

**Veredicto:** ✅ PASA — 14/14 AC y visto bueno visual del owner (2026-10-02).

Archivos de evidencia:

- `utils` = `src/app/core/utils/alumnos-sort.utils.spec.ts`
- `comp` = `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.spec.ts`
- `facade` = `src/app/core/facades/admin-alumnos.facade.spec.ts`
- `e2e` = `e2e/alumnos-b-lista.spec.ts`, bloque "ordenar por columna (spec 0020-m)"

---

## Verificación por AC

| AC | Estado | Evidencia |
|---|---|---|
| AC1 — clic ordena ascendente, segundo clic invierte | ✅ | `e2e` "un clic ordena ascendente…"; `utils` `nextAlumnoSort` |
| AC2 — 8 columnas ordenables, "Acciones" no | ✅ | `utils` `ALUMNO_SORT_OPTIONS`; `comp` "Sede solo se ofrece cuando la columna se muestra"; `e2e` (secretaria sin botón de Sede) |
| AC3 — indicador solo en la columna ordenada | ✅ | `comp` "solo la columna ordenada muestra el indicador"; `e2e` `aria-sort` |
| AC4 — el orden abarca todas las páginas | ✅ | `e2e` "el orden abarca todas las páginas y vuelve a la primera al cambiarlo" |
| AC5 — el filtro conserva el orden | ✅ | `comp` "el resultado de un filtro sigue ordenado…"; `e2e` (búsqueda + orden) |
| AC6 — Fecha Ingreso por fecha real | ✅ | `utils` "Fecha Ingreso: ordena por la fecha real"; `facade` `fechaIngresoIso`; `e2e` "Fecha Ingreso ordena por la fecha real…" |
| AC7 — Alumno por apellido y nombre, sin tildes | ✅ | `utils` bloque "Alumno" |
| AC8 — sin orden elegido, como hoy | ✅ | `utils` "sin orden elegido devuelve la lista tal como llegó"; `e2e` primer `toHaveText` |
| AC9 — se conserva solo al volver de la ficha | ✅ | `e2e` "…el orden se conserva al volver de la ficha" (vuelta desde la ficha y entrada por el menú); `facade` filtros con `sort` |
| AC10 — tercer clic vuelve al orden por defecto | ✅ | `utils` "tercer clic…"; `comp`; `e2e` |
| AC11 — control "Ordenar por" en la vista de tarjetas | ✅ | `comp` bloque "control Ordenar por"; `e2e` "en la vista de tarjetas se ordena con el control Ordenar por" (oculto con la tabla visible) |
| AC-E1 — filas sin dato al final | ✅ | `utils` bloque "filas sin dato" |
| AC-E2 — varias matrículas: primer valor de la fila | ✅ | `utils` "Nº Exp." y "Curso" |
| AC-E3 — Papelera | ✅ | Mismo componente y misma lista `sortedAlumnos`; no hay rama propia para la Papelera. Sin test E2E dedicado |

### Resultados de la corrida (2026-10-02)

- `npx vitest run` → 3003 pasan, 5 omitidos (los mismos de antes).
- `npm run lint:arch` → 0 errores, 178 avisos (igual que antes del cambio).
- `npx playwright test e2e/alumnos-b-lista.spec.ts` → 30/30.
- `tsc -p tsconfig.app.json --noEmit` → sin errores.

### Revisión en el navegador

- 1600 px, admin "Todas las sedes" (caso más ancho: 9 columnas), claro y oscuro: los títulos
  conservan la tipografía micro-label; el indicador es una flecha doble tenue en reposo y un
  chevron en la columna ordenada. Consola sin errores.
- **Ancho de la tabla:** con el ícono dentro del flujo, a 1600 px aparecía scroll horizontal y se
  cortaba la columna Acciones (ancho 1246 px en un contenedor de 1174). Se corrigió sacando el
  ícono del flujo: el ancho quedó idéntico al de antes del cambio en 1440, 1600 y 1920 px.
- 1280 px y 375 px: la lista se ve como tarjetas y la barra muestra "Ordenar por" + botón
  "Ascendente/Descendente"; a 375 px el botón baja de línea y no hay scroll horizontal.

---

## Out-of-scope respetado

- ❌ Base de Alumnos Profesional y Ex-Alumnos — no se tocaron.
- ❌ Orden por más de una columna — no entró.
- ❌ Orden en el servidor — no entró.
- ❌ Exportación con el orden de pantalla — no entró.

---

## Deuda detectada (no bloquea)

- A 1440–1600 px con la columna Sede visible, el título "Fecha Ingreso" se parte en dos líneas y
  algunas fechas también (`22-09-` / `2026`). Ya pasaba antes de esta spec.
- A 1440 px la tabla ya tenía scroll horizontal antes de esta spec (1133 px en 1014).

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando
- [x] `lint:arch` sin errores
- [x] Visto bueno visual del owner (incluye D1 y D2) — Matías, 2026-10-02
