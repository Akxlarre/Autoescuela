# Plan 0020-m — Ordenar la tabla de la Base de Alumnos B por columna

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-10-02
> **Talla:** S

> Aprobación: el owner pidió implementar esta función el 2026-10-02 ("sigue con la de ordenar la
> tabla por col"). Las decisiones D1 y D2 de la spec se tomaron con la opción recomendada y
> quedan sujetas a su visto bueno visual.

---

## 1. Resumen ejecutivo

El orden se resuelve en el navegador con una función pura (`sortAlumnos`) aplicada sobre la lista
ya filtrada, de modo que tabla, tarjetas y paginador comparten un único estado de orden. Los
títulos de columna pasan a ser botones que recorren el ciclo ascendente → descendente → por
defecto. El estado viaja junto a los filtros que el Facade ya conserva al volver de la ficha.

No se usa el ordenamiento propio de `p-table` (`pSortableColumn`): ordena solo la tabla, no las
tarjetas, y compara el texto de la celda (la fecha `dd-mm-aaaa` quedaría mal ordenada).

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/core/utils/alumnos-sort.utils.ts` | Util puro | `sortAlumnos(rows, sort)`, `nextAlumnoSort(current, field)`, `toggleAlumnoSortDirection(sort)`, `ALUMNO_SORT_OPTIONS`. AC1, AC5–AC8, AC10, AC-E1, AC-E2 |
| `src/app/core/utils/alumnos-sort.utils.spec.ts` | Test Vitest | Un caso por columna, vacíos al final, estabilidad, ciclo de 3 clics |
| `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.spec.ts` | Test Vitest | `sortedAlumnos` respeta filtro + orden; el orden inicial se toma de `initialFilters`; cambiar el orden emite `filtersChanged` |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/models/ui/alumno-table-row.model.ts` | Tipos `AlumnoSortField`, `AlumnoListSort`; `AlumnoListFilters.sort`; `AlumnoTableRow.fechaIngresoIso` | AC6, AC9 |
| `src/app/core/facades/admin-alumnos.facade.ts` | El mapeo de la fila suma `fechaIngresoIso` (`enrollments.created_at` sin formatear) | AC6 |
| `src/app/core/facades/admin-alumnos.facade.spec.ts` | Los filtros vacíos incluyen `sort: null`; caso de `fechaIngresoIso` | AC6, AC9 |
| `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` | Señal `sort`, `sortedAlumnos`, títulos de columna como botones con `aria-sort`, control "Ordenar por" para la vista de tarjetas, vuelta a la primera página al cambiar el orden | AC1–AC5, AC10, AC11, AC-E3 |
| `e2e/alumnos-b-lista.spec.ts` | Casos G03: ciclo de 3 clics, orden por fecha, orden conservado al volver de la ficha | AC1, AC3, AC6, AC9, AC10 |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `app-icon` — indicador de sentido (`chevron-up`, `chevron-down`, `arrow-up-down`; los tres ya
  están registrados en `app.config.ts`).
- `p-select` — control "Ordenar por" de la vista de tarjetas.

### Facades/Services existentes que extendemos
- `AdminAlumnosFacade.listFilters` / `setListFilters()` / `resetListFilters()` — el orden viaja
  dentro de `AlumnoListFilters`, así los Smart Components (admin y secretaria) no cambian y la
  regla "solo al volver de la ficha" (`hotfix-126-m`) aplica sin código nuevo.

### Componentes/Facades que NO existen y debemos crear
- `alumnos-sort.utils.ts`. `sortByPaternalLastNameAsc` (`student-name.util.ts`) no sirve: ordena
  otra estructura y solo por apellido.

---

## 4. Modelo de datos

N/A — sin cambios en BD ni RLS.

### Modelos UI/DTO

- `AlumnoSortField` = `alumno | rut | nroExpediente | curso | sede | fechaIngreso | estado | expediente`
- `AlumnoListSort` = `{ field: AlumnoSortField; direction: 'asc' | 'desc' }`
- `AlumnoListFilters.sort: AlumnoListSort | null` (`null` = orden por defecto)
- `AlumnoTableRow.fechaIngresoIso?: string | null`

---

## 5. Arquitectura del feature

```
AdminAlumnosComponent / SecretariaAlumnosComponent   (sin cambios)
   └─ <app-alumnos-list-content [initialFilters] (filtersChanged)>
         sort = signal<AlumnoListSort | null>
         filteredAlumnos() ──► sortedAlumnos() = sortAlumnos(filtered, sort())
                                   ├─► p-table [value]
                                   └─► visibleCards()
```

### Criterio de comparación por columna

| Columna | Se ordena por |
|---|---|
| Alumno | apellido + nombre, sin tildes ni mayúsculas (`localeCompare` `es`, `sensitivity: 'base'`) |
| RUT | número antes del guion |
| Nº Exp. | primer número de la fila, comparación numérica |
| Curso | nombre del primer curso de la fila |
| Sede | nombre de la sede |
| Fecha Ingreso | `fechaIngresoIso` |
| Estado | texto del estado, alfabético |
| Expediente | cantidad de documentos presentes (Pendiente → Parcial → Completo) |

Un valor vacío o `—` va siempre al final. Los empates conservan el orden de llegada (más
recientes primero).

---

## 6. Restricciones aplicables

- [x] `architecture.md` — la lógica vive en un util puro; el componente solo la invoca
- [x] `models.md` — tipos en `core/models/ui/`
- [x] `visual-system.md` — `.micro-label` en los títulos, `app-icon`, sin colores hardcodeados
- [x] `testing-tdd.md` — `.spec.ts` del util primero
- [x] `ai-readability.md` — `data-llm-action` en los botones de orden

---

## 7. Plan de testing

- Unitarios: `alumnos-sort.utils.spec.ts`, `alumnos-list-content.component.spec.ts`, facade.
- E2E: 3 casos nuevos en `e2e/alumnos-b-lista.spec.ts`.
- Visual: `/verify` en `/app/admin/alumnos` a 1440 px (tabla) y 1280 px / 375 px (tarjetas),
  modo claro y oscuro.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| El paginador queda en una página intermedia al cambiar el orden | Media | Volver a la primera página en cada cambio de orden |
| El control de tarjetas descuadra la barra de filtros en 375 px | Media | Captura a 375 px en `/verify` |
| Tests que comparan `AlumnoListFilters` con `toEqual` | Alta | Actualizarlos en la misma tarea del modelo |

---

## 9. Orden de implementación

1. Modelo + util + spec del util
2. Facade (`fechaIngresoIso`) + spec
3. Componente + spec
4. E2E
5. Validación (`test:ci`, `lint:arch`, `/verify`) e índices

---

## Changelog

- 2026-10-02 — plan inicial
