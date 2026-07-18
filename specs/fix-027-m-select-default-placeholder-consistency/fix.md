# fix-027-m — Consistencia visual del valor por defecto en `p-select` de filtros

## Problema
En toda la app hay `p-select` de filtros que usan el mismo modelo (`null` o
`''` = "sin filtro"), pero la opción por defecto ("Todos los X") se ve
**negra** (como una selección real) en algunos selects y **gris/muted**
(estilo placeholder) en otros — inconsistencia detectada primero en
`admin-auditoria.component.ts` (Secretaria=negro, Acción/Módulo=gris).

## Causa raíz
Cuando el array de `options` incluye una entrada explícita
`{ label: 'Todos los X', value: null }` (o `value: ''`) que coincide con el
valor inicial del signal, PrimeNG la resuelve como una opción seleccionada
real y la pinta con el color normal de texto (negro). Cuando esa entrada NO
existe y el select solo depende del atributo `placeholder`, PrimeNG no
encuentra opción coincidente y renderiza el `placeholder` con su estilo
muted (gris) nativo — sin necesidad de CSS extra.

## Decisión de diseño
Estandarizar en **gris/muted para el estado "sin filtro"** (comportamiento
nativo de `placeholder` en PrimeNG), reservando el color de texto normal
(negro) para una selección real hecha por el usuario. Es el patrón habitual
en filtros de tablas: permite distinguir de un vistazo qué filtros están
realmente activos.

## Cambio
En cada `p-select` de filtro que actualmente incluye una opción por defecto
`{ label: '...', value: null | '' }`:
1. Eliminar esa entrada del array de `options`.
2. Asegurar que el `p-select` tenga `placeholder="<mismo texto de la opción eliminada>"`.
3. No tocar la lógica de filtrado (ya trata `null`/`''` como "sin filtro").

### Archivos afectados (options con `value: null` o `value: ''`)
- `admin-auditoria.component.ts` (Secretaria, Acción, Módulo)
- `admin-secretarias.component.ts` (Sede, Estado)
- `admin-profesional-promociones.component.ts`
- `asistencia-clase-b-content.component.ts`
- `flota-list-content.component.ts`
- `admin-ex-alumnos.component.ts` (Año)
- `admin-pre-inscritos.component.ts` (Estado, Clase)
- `secretaria-ex-alumnos.component.ts`
- `secretaria-alumnos-pre-inscritos.component.ts`
- `ex-alumnos-profesional-content.component.ts`
- `alumnos-profesional-list-content.component.ts`
- `alumnos-list-content.component.ts`
- `registrar-anticipo-drawer.component.ts`
- `admin-contabilidad-cursos.component.ts`

(Se auditan todos durante la implementación; algunos `value: null/''` pueden
NO ser opciones "Todos" de un filtro — ej. un campo de formulario real donde
`null` es una opción de negocio válida — esos casos NO se tocan.)

## Acceptance Criteria
- [x] Todos los `p-select` de tipo "filtro de listado" (no formularios) que
      antes mostraban su opción por defecto en negro, ahora la muestran
      en gris vía `placeholder` nativo de PrimeNG.
- [x] La lógica de filtrado (`filteredX` computed) sigue funcionando igual:
      sin selección = sin filtro aplicado.
- [x] No se rompen tests existentes relacionados (`npm run test:ci`).

## Addendum — variante con sentinel string ('todos'/'todas')
Se detectó una variante del mismo problema: algunos `p-select` no usan
`null`/`''` como "sin filtro" sino un string sentinel (`value: 'todos'`),
con el signal inicializado en ese mismo string. Mismo defecto visual
(opción por defecto en negro), mismo fix (quitar la opción del array +
placeholder), pero además hay que:
1. Cambiar el signal inicial de `'todos'` a `null`.
2. Cambiar el chequeo del filtro de `x === 'todos'` a `!x` (ambos ya
   tratan "sin selección" como "sin filtro", `null` es igual de válido).

### Archivos adicionales (sentinel 'todos'/'todas' en un `p-select` real,
no en pills/tabs — se descartó `asistencia-clase-b-content` filterTabs,
`dms-list-content` categoryFilters, `instructor-tareas`/`instructor-alumnos`
statusFilters, y `hero-tab.component.ts` por ser botones tipo tab, no selects):
- `secretaria-pagos.component.ts` (Estado, Método)
- `admin-pagos.component.ts` (Estado, Método)
- `admin-profesional-relatores.component.ts` (Especialidad, Estado)
- `certificacion-profesional-content.component.ts`
- `certificacion-clase-b-content.component.ts`
- `servicios-especiales-content.component.ts`
