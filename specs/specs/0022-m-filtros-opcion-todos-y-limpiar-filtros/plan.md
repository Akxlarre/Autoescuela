# Plan 0022-m — Opción "Todos" en los filtros y botón compartido "Limpiar filtros" en todas las listas

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (Matías, 2026-10-02 — talla M)
> **Created:** 2026-10-02

---

## 1. Resumen ejecutivo

Se crean dos piezas compartidas: la función pura `withAllOption()` (antepone la opción "todos"
a una lista de opciones de filtro) y el componente `app-clear-filters-button` (el botón
"Limpiar filtros" de Pagos, visible solo con filtros activos). Después se aplican, pantalla por
pantalla, a las 16 listas con filtros y a los 3 selectores del Nuevo comunicado. Sin BD.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/core/utils/filter-options.utils.ts` (+ `.spec.ts`) | Util pura | `withAllOption(options, label, value = null)` |
| `src/app/shared/components/clear-filters-button/clear-filters-button.component.ts` | Dumb | Botón "Limpiar filtros": `active` (input), `clear` (output) |

### Archivos a MODIFICAR

Patrón por pantalla: (1) opciones con `withAllOption()`; (2) `computed` de filtros activos que
incluye el buscador; (3) `<app-clear-filters-button>` al final de la barra; (4) método que
limpia todo (se reutiliza el `resetFilters()`/`clearFilters()` existente o se crea).

| Path | Filtros |
|------|---------|
| `shared/components/alumnos-list-content/alumnos-list-content.component.ts` | Curso, Estado, Expediente (default `''`; el orden se conserva) |
| `shared/components/alumnos-profesional-list-content/…component.ts` | Clase, Estado |
| `shared/components/ex-alumnos-profesional-content/…component.ts` | Clase |
| `shared/components/pre-inscritos-content/…component.ts` | Estado, Clase (default `''`) |
| `shared/components/flota-list-content/…component.ts` | Tipo, Estado (emite cambios al padre) |
| `features/admin/secretarias/admin-secretarias.component.ts` | Sede, Estado |
| `features/admin/profesional-relatores/…component.ts` | Especialidad, Estado |
| `features/admin/profesional-promociones/…component.ts` | Estado (se quita `showClear`) |
| `features/admin/contabilidad-cursos/…component.ts` | Tipo, Estado (default `''`) |
| `features/admin/auditoria/admin-auditoria.component.ts` | Usuario, Acción, Módulo (botón propio → compartido) |
| `features/admin/pagos/admin-pagos.component.ts` | Curso (botón propio → compartido) |
| `features/secretaria/pagos/secretaria-pagos.component.ts` | Curso (botón propio → compartido) |
| `features/admin/pagos/pagos-recientes-drawer.component.ts` | Estado, Método |
| `features/admin/servicios-especiales/historial-ventas-drawer.component.ts` | Servicio (se quita `showClear`) |
| `shared/components/agenda-semanal/agenda-semanal.component.ts` | Instructor (emite al padre) |
| `shared/components/asistencia-clase-b-content/…component.ts` | Instructor |
| `shared/components/certificacion-clase-b-content/…component.ts` | Estado |
| `shared/components/certificacion-profesional-content/…component.ts` | Estado |
| `features/comunicados/announcement-composer-drawer.component.ts` | Sede, Tipo de curso, Estado — solo opción "todos", sin botón |
| Specs `.spec.ts` existentes de las pantallas tocadas | Ajustar/añadir tests del cálculo de filtros activos |
| `indices/COMPONENTS.md`, `indices/UTILS.md` | Registrar las dos piezas nuevas |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

- Patrón de Pagos (`hayFiltrosActivos()` + `limpiarFiltros()` + `btn-ghost` con ícono `x`): es el
  modelo visual y de comportamiento del componente nuevo.
- `resetFilters()` / `clearFilters()` existentes en las listas que ya tienen "Limpiar filtros" en
  el estado vacío: el botón llama al mismo método (AC-E3).
- `<app-icon>` con `x` (ya registrado).
- No existe un componente compartido de "limpiar filtros" (`indices/COMPONENTS.md`): se crea.

---

## 4. Modelo de datos

N/A.

---

## 5. Arquitectura del feature

```
Lista (Smart u Organismo)
  ├─ opciones = withAllOption(opcionesBase, 'Todos los …', valorDefault)   ← core/utils
  ├─ hasActiveFilters = computed(search ≠ '' || filtro_i ≠ default_i)
  └─ <app-clear-filters-button [active]="hasActiveFilters()" (clear)="resetFilters()" />  ← Dumb
```

Sin Facades nuevos. Auditoría limpia vía su `AuditoriaFacade.clearFilters()` existente.

---

## 6. Restricciones aplicables

- [x] OnPush, `input()`/`output()`, control flow nativo (componente nuevo)
- [x] Dumb sin Facades (`app-clear-filters-button`)
- [x] Tokens del DS (`btn-ghost`), sin colores Tailwind
- [x] `data-llm-action` en el botón
- [x] Functional Core: `withAllOption` en `core/utils/` con tests
- [ ] Migración / RLS
- [ ] SWR / Realtime

---

## 7. Plan de testing

- `filter-options.utils.spec.ts`: antepone la opción, respeta el valor por defecto, no muta la
  entrada.
- Tests de componente donde ya hay spec: `hasActiveFilters` false/true (con buscador y con
  selectores) y que limpiar deja todo en el valor por defecto; en la Base de Alumnos, que el
  orden se conserva (ya existe) y que la opción "todos" es la primera.
- `npm run lint:arch`, `npm run test:ci`.
- `/verify` (Playwright) en Base de Alumnos, Pagos, Flota y Nuevo comunicado.

---

## 8. Riesgos

- **Valor por defecto distinto según pantalla** (`null`, `''`): si la opción "todos" usa otro
  valor, el filtro no se reconoce como vacío y el botón no desaparece (AC-E2). Mitigación: pasar
  siempre el default real de cada signal a `withAllOption`.
- **Filtros que comparan con `!valor`**: `''` y `null` son falsy, así que elegir "todos" quita
  el filtro sin tocar la lógica de filtrado. Revisar cada predicado al tocarlo.
- **Filtros de la Base de Alumnos que se guardan al ir a la ficha** (`hotfix-126-m`): limpiar
  debe emitir `filtersChanged` para que lo guardado también quede limpio (AC-E1).
- **Listas que delegan el filtro al padre** (Flota, Agenda): el botón emite los outputs con el
  valor por defecto; el padre no cambia.

---

## 9. Orden de implementación

1. `withAllOption` + tests.
2. `app-clear-filters-button`.
3. Base de Alumnos B (pantalla de referencia) → `/verify`.
4. Resto de listas.
5. Pagos y Auditoría migran al componente compartido.
6. Nuevo comunicado.
7. Lint, tests, `/verify`, índices.
