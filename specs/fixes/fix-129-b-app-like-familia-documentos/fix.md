# Fix: App-like: familia "documentos" (`admin` + `secretaria`)
> id: fix-129-b-app-like-familia-documentos
> refs: ASG-b-071
> status: done
> closed: 2026-08-10
> created: 2026-08-10

## Root Cause

[Heredado de ASG-b-071, a confirmar]: `/admin/documentos` y `/secretaria/documentos` comparten
el componente `dms-list-content` (4 tabs: `students`/`school`/`templates`/`instructors`), con
root hoy `bento-grid--rows-fit` — no sigue el patrón app-like (fill-screen desktop / scroll
interno), a diferencia de las piezas ya migradas del rollout (065/066/067/070/083).

**Hallazgo importante de la Asignación:** la tab "students" tiene `h-125` (500px)
**hardcodeado** — anti-patrón que hay que sacar ANTES de aplicar fill, porque una altura fija
no convive con `.bento-fill`.

## ACs Afectados

Ninguno — fix autónomo (rollout de layout, no cambia contrato de negocio).

## Cambio

**Archivo:** `src/app/shared/components/dms-list-content/dms-list-content.component.ts`

1. Root `bento-grid--rows-fit` → `bento-grid--fill-screen-kpi` (3 filas: hero/tabs-nav/panel).
2. Hero y tabs-nav pasan a ser **siempre presentes** (antes solo se renderizaban en el `@else`
   de `isLoading()`, ocultando estructura durante carga). El hero ahora recibe
   `[loading]="isLoading()"` (mismo patrón que `flota-list-content`) en vez de tener su propio
   skeleton-row aparte.
3. Todo el `@switch(activeTab())` quedó envuelto en **una sola celda** `.bento-banner
   .bento-fill.flex.flex-col.h-full.min-h-0`, con el switch en un sub-wrapper `flex-1 min-h-0`
   y el bloque "Permisos DMS" como footer `shrink-0` fuera del switch pero dentro de la misma
   celda fill (antes era una fila `col-span-full` separada — bajo `--fill-screen-kpi`, con solo
   3 filas explícitas, una 4ª fila top-level habría desbordado el contrato de 100vh).
4. El skeleton de carga se simplificó a 2 bloques dentro del panel (se eliminaron el bloque de
   120px que simulaba el hero y la fila de 4 botones que simulaba las tabs — ya no hacen falta
   porque hero/tabs-nav ahora se renderizan siempre, con su propio estado `loading`).
5. **Tab "students":** `h-125` (500px fijo) eliminado. Las 2 columnas (`col-span-8`/`col-span-4`
   del grid padre) se convirtieron en un `flex flex-col lg:flex-row` interno con
   `lg:basis-2/3`/`lg:basis-1/3` (fracciones nativas de Tailwind, sin arbitrary values) — cada
   columna `h-full min-h-0`. La tabla de alumnos suma `[scrollable]="true" scrollHeight="flex"`
   (mismo patrón que `alumnos-list-content`/`flota-list-content`), manteniendo el paginador
   condicional (`length > 10`). La lista "Últimos subidos" ya tenía `overflow-y-auto flex-1`,
   solo se le agregó `min-h-0`.
6. **Tab "instructors":** `h-125` → `h-full min-h-0`; misma adición de
   `[scrollable]="true" scrollHeight="flex"` a la tabla, manteniendo el paginador condicional.
7. **Tab "school":** no tenía altura fija ni scroll propio (crecía con la página bajo el layout
   viejo). Ahora `h-full min-h-0` en la card y `overflow-y-auto flex-1 min-h-0` en la lista de
   documentos — antes esta tab no estaba cubierta por el "6 páginas hermanas" (era solo lista,
   no `p-table`).
8. **Tab "templates":** header y filtro de categorías quedan `shrink-0` (siempre visibles); el
   grid de cards + la nota "Cómo usar las plantillas" quedan en un sub-wrapper
   `flex-1 min-h-0 overflow-y-auto` — scroll interno propio, antes crecía con la página.
9. **Regla nueva de empty-state centrado** (checklist del rollout): se agregó el wrapper
   `flex-1 flex items-center justify-center` a los empty-states de "school" y "templates" que
   no lo tenían (los de "students"/"instructors" ya lo tenían).

**Fuera de scope, encontrado pero NO tocado:** línea ~473 del archivo (tab "school") tiene un
atributo `class` duplicado en el ícono de cada documento institucional (`class="w-10 h-10
rounded-lg..."` seguido de `class="bg-error-subtle text-error"` en el mismo elemento) — el
segundo pisa al primero, así que el ícono pierde tamaño/bordes redondeados. Es un bug visual
preexistente, no relacionado a la causa raíz de este fix (layout app-like); no se corrigió para
no ampliar el diff de este track. Vale un fix propio.

## Test de Regresión

- Sin lógica de densidad nueva (paginadores condicionales ya existían, sin `computed()` nuevo)
  → sin `.spec.ts` obligatorio nuevo, consistente con la regla explícita del checklist heredado.
- `npx tsc --noEmit`: sin errores.
- `npx ng build --configuration development`: build completo sin errores (valida también el
  template inline, que `tsc` solo no cubre del todo).
- `npm run lint:arch`: exit 0, 0 errores. Único warning en el archivo (`text-error` en
  `ARCH-11`) es preexistente (confirmado con `git diff`, solo cambió indentación por prettier).
- `/verify` manual en navegador (`ng serve`, logueado como admin, `/admin/documentos`):
  - 1440×900: `documentScrolls:false` (`html.scrollHeight === html.clientHeight`). Tabla de
    alumnos con scroll interno propio confirmado (`.p-datatable-table-container`
    `scrollHeight:788` vs `clientHeight:201`, panel `.bento-fill` a 563px real).
  - Las 4 tabs (Alumnos/Instructores/Escuela/Plantillas) probadas por click real
    (`data-llm-nav="dms-tab"`): cada una renderiza su contenido, paginador, empty-state
    centrado (Plantillas sin resultados) y "Permisos DMS" visible al fondo del panel.
  - 390×812 (mobile): `.bento-grid` mide 2845px de alto real (natural, sin `contain:size` — la
    media query que lo aplica está scopeada a `min-width: lg`), y `.shell-content` (el
    scroller real de la shell, no `html`) tiene `scrollHeight:2861` vs `clientHeight:736` →
    scroll nativo confirmado, consistente con "mobile-first, sin fill".
  - `force-compact`: no aplica — confirmado por grep, ni `AdminDocumentosComponent` ni
    `SecretariaDocumentosComponent` ni `DmsListContentComponent` inyectan
    `LayoutDrawerFacadeService`.
  - `read_console_messages`: mismos 7 `InvalidStateError` (Transition aborted) presentes antes
    y después del cambio en TODA la app (no específicos de esta página) — preexistentes, no
    relacionados (no se tocó código de navegación/transiciones).
- `/secretaria/documentos` verificado en vivo (logout de admin + login `secretaria@test.com`):
  tabla de alumnos SIN columna Sede (secretaria de una sola sede), botones "Eliminar" ausentes
  (`isAdmin=false`), `documentScrolls:false` en 916×918, mismos `InvalidStateError`
  preexistentes sin errores nuevos. Confirma que `SecretariaDocumentosComponent` (wrapper
  delgado idéntico a `AdminDocumentosComponent`, mismo `<app-dms-list-content>` sin wrapper de
  layout propio) hereda el árbol app-like sin regresiones.
