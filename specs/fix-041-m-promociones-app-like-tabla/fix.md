# fix-041-m — Promociones Profesionales: app-like + rediseño de fila

## Contexto

El dueño reportó dos problemas en `admin-profesional-promociones` (vista
"Promociones Profesionales"):

1. **App-like no garantizado con múltiples promociones.** El componente
   actual (`admin-profesional-promociones.component.ts`) NO usa el patrón
   fill-screen: el grid raíz es `.bento-grid` sin el modificador
   `--fill-screen`, y el contenido usa `min-h-100` fijo + paginación manual
   (`pageSize = 10`, `currentPage` signal) en vez de `.bento-fill`. Con solo
   1 promoción no se nota, pero no hay garantía de que quepa sin scroll del
   documento cuando haya varias.
2. **Diseño de fila poco logrado.** El dueño pidió reemplazar el diseño
   actual de cada fila de promoción (texto + mini-pills + botones sueltos)
   por "otro diseño usado en alguna vista de la app que sea mejor".

## Alcance

Aplicar el mismo patrón ya validado en fix-040 para Relatores: reemplazar
la lista manual (paginación custom + filas hechas a mano) por un
`<p-table>` de PrimeNG con `scrollHeight="flex"` dentro del shell
`.bento-grid--fill-screen` + `.bento-fill`, igual que
`AlumnosListContentComponent` (Base Alumnos B) y la nueva
`admin-profesional-relatores.component.ts`. Esto resuelve ambos pedidos a
la vez: el fill-screen queda garantizado (PrimeNG calcula el alto
disponible internamente) y el diseño de fila pasa a ser el mismo sistema de
tabla ya usado en el resto de la app (columnas + `p-tag` + botones
`pButton`/`pTooltip` agrupados).

Solo se toca `admin-profesional-promociones.component.ts`. No se toca
`PromocionesFacade` ni los drawers de crear/ver/editar.

## Acceptance Criteria

- [x] AC0: El shell raíz usa `.bento-grid.bento-grid--fill-screen` y el
  contenedor de la tabla usa `.bento-banner.bento-fill`, igual que
  `admin-alumnos` / `admin-profesional-relatores`.
- [x] AC1: La tabla usa `<p-table>` con `scrollHeight="flex"` y paginador
  nativo, sin lógica de paginación manual (`currentPage`/`pageSize`
  eliminados).
- [x] AC2: Cada fila muestra: nombre + código de la promoción, fechas de
  inicio/fin, alumnos inscritos/máximo, badges de cursos, estado (`p-tag`
  con severidad por status incluyendo `finished`) y acciones (ver/editar
  vía `pButton`/`pTooltip`).
- [x] AC3: Estado vacío vía `<app-empty-state>` (mismo componente ya usado
  en Relatores/Alumnos).
- [x] AC4: `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos.

## Cierre

`admin-profesional-promociones.component.ts` reescrito completo siguiendo
el mismo patrón que `admin-profesional-relatores.component.ts` (fix-040) y
`AlumnosListContentComponent`:

- Shell `.bento-grid.bento-grid--fill-screen` + `.bento-banner.bento-fill`,
  sin `min-h-100` ni paginación manual.
- `<p-table>` con `scrollHeight="flex"`, columnas Promoción (icono +
  nombre/código), Fechas, Alumnos, Cursos (badges con tooltip), Estado
  (`p-tag`, ahora con severidad propia para `finished` que antes caía en
  el default) y Acciones (`pButton` ver/editar).
- `estadoOptions` del filtro ahora incluye "Finalizada" (antes faltaba).
- Estado vacío vía `<app-empty-state>`.
- Se eliminaron: `BadgeComponent`, `.promo-row`/`.action-btn`/
  `.pagination-btn` (CSS), `currentPage`/`pageSize`/`totalPages`/
  `paginatedPromociones`/`paginationStart`/`paginationEnd`, `statusVariant`
  (reemplazado por `statusSeverity` con severidades de `p-tag`).
- `PromocionesFacade` y los drawers de crear/ver/editar no se tocaron.
- `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos.

## Test de Regresión

Este fix es puramente de template/UI (no toca `PromocionesFacade` ni
lógica de negocio), por lo que no hay un caso unitario nuevo que agregar.
Verificación: `npx vitest run src/app/core/facades/promociones.facade.spec.ts`
→ 3/3 verde (el contrato de datos que consume la tabla nueva sigue intacto)
+ `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos.

## Segundo ajuste (pedido explícito del dueño): tabla → cards

Tras ver el resultado, el dueño preguntó si una tabla era realmente la
mejor opción visual para Promociones. Se le dio una opinión honesta: a
diferencia de Relatores (entidad plana, alto volumen potencial), una
promoción trae datos anidados por curso (courseCode + enrollment +
relatores) que una fila de tabla aplana demasiado, y normalmente hay pocas
promociones a la vez — ahí las cards muestran mejor jerarquía visual sin
sacrificar densidad de forma relevante. El dueño pidió cards manteniendo
app-like.

- Se quitó `<p-table>` y `TableModule`. El contenido pasa a un
  `.bento-grid.promo-grid` (grid nested, sin `flex-1`/`h-full`/
  `grid-auto-rows` manuales — a diferencia del intento fallido en fix-040,
  aquí NO se necesita forzar que las filas llenen el alto exacto: el
  tamaño natural por contenido (`height: fit-content` propio de
  `.bento-grid`) es justamente lo correcto para cards de altura variable).
  El wrapper de contenido es `p-4 lg:p-5 flex-1 min-h-0 overflow-y-auto`
  SIN paginación (se eliminó — bajo volumen esperado de promociones, no
  amerita paginador; si hay muchas, el scroll interno del `.bento-fill` ya
  cubre el caso).
- Cada `.promo-card`: header (ícono calendario + nombre/código + `p-tag`
  de estado), meta (fechas + alumnos inscritos/máximo con íconos), badges
  de cursos con tooltip (`courseName: enrolled/max alumnos`), footer con
  conteo de cursos + acciones (`pButton` ver/editar).
- Estado vacío (`app-empty-state`) ahora es un `@else if` independiente
  del `@else` de la grilla (antes vivía dentro del `emptymessage` de
  `p-table`).
- `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos.

## Tercer ajuste: reintroducir paginación con íconos

El dueño notó que al pasar de tabla a cards se perdieron los controles de
paginación (el paginador nativo de `p-table` desapareció junto con la
tabla). Se reintrodujo paginación client-side para el grid de cards:

- `currentPage` signal + `pageSize = 6` (2 filas × 3 columnas, mismo
  criterio usado en Relatores) + `paginatedPromociones`/`totalPages`/
  `paginationStart`/`paginationEnd` computed.
- Footer de paginación (visible cuando `filteredPromociones().length > 0`)
  con texto "Mostrando X-Y de Z promociones" + botones "Anterior"/
  "Siguiente" con íconos `chevron-left`/`chevron-right` (`pButton
  p-button-outlined`), deshabilitados en los extremos.
- Cambiar búsqueda o filtro de estado resetea `currentPage` a 1.
- `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos.

## Cuarto ajuste: los íconos de paginación no coincidían con la convención real de la app

El dueño notó que esos íconos de paginación (`chevron-left`/`chevron-right`
en botones `pButton p-button-outlined`) no se usan en ningún otro lado de
la app para paginar listas. Se auditó el patrón real: `admin-instructores`,
`admin-secretarias`, `admin-auditoria`,
`admin-contabilidad-historial-cuadraturas` (y varios más) todos usan
botones de texto plano con la clase compartida `.pagination-btn` — **sin
ningún ícono**. Se corrigió para igualar esa convención real en vez de
inventar una nueva:

- Botones "Anterior"/"Siguiente" ahora son `<button class="pagination-btn">`
  sin `pButton` ni íconos, idénticos a los de `admin-instructores.component.ts`.
- Se agregó la clase `.pagination-btn` (mismo CSS exacto que en
  `admin-instructores`: borde + hover en `var(--ds-brand)` +
  `opacity: 0.4` cuando `disabled`) al bloque de estilos del componente.
- La lógica de `[disabled]` (`currentPage() === 1` / `currentPage() >=
  totalPages()`) no cambió — ya era correcta (con 1 sola promoción y
  `pageSize=6`, `totalPages()` da 1, así que ambos botones quedan
  deshabilitados); el problema reportado era puramente que el estilo
  `p-button-outlined` no comunicaba visualmente el estado disabled con
  suficiente claridad, a diferencia de `.pagination-btn:disabled` que sí
  baja la opacidad de forma explícita.
- `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos.
