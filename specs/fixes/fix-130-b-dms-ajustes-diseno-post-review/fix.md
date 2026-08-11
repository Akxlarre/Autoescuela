# Fix: Ajustes de diseño post-review en DMS app-like (continuación de fix-129-b)
> id: fix-130-b-dms-ajustes-diseno-post-review
> refs: fix-129-b-app-like-familia-documentos
> status: done
> closed: 2026-08-10
> created: 2026-08-10

## Root Cause

El owner revisó fix-129-b en vivo (screenshots con el drawer de "Subir documento" abierto) y
encontró 4 problemas de diseño:

1. **Tabs `variant="line"` no sirve acá.** En su tier más angosto colapsa a solo íconos sin
   fondo — con el drawer de upload abierto (que angosta `<main>`), las 4 tabs de DMS quedan
   como 4 íconos sueltos sin contenedor visual. `variant="segmented"` (fondo `bg-subtle`,
   labels siempre visibles con scroll horizontal si hace falta) es más robusto para este caso
   y es el otro variant canónico ya usado en el proyecto (`alumno-horario.component.ts`).
2. **"Últimos subidos" se rompe con el drawer abierto** (texto superpuesto, columna
   angostísima). Causa raíz real: el split 2 columnas de la tab "students" usa `lg:flex-row` +
   `lg:basis-2/3`/`lg:basis-1/3` — breakpoints de **viewport** de Tailwind, no de contenedor.
   Cuando el drawer angosta `<main>` sin cambiar el ancho de la ventana, `lg:` sigue activo y
   fuerza el layout de 2 columnas en un espacio que ya no alcanza. Es el mismo error que
   `visual-system.md` ya documenta como trampa resuelta en spec 0030: "Switch de layout por
   CONTENEDOR, NO por `lg:` de Tailwind". `flota-list-content`/`alumnos-list-content` ya
   resuelven esto con un `@container` local (`flotaContainer`/`dual-viewport-container`) —
   patrón a replicar acá.
3. **Card "Permisos DMS" no debe estar.** Quedó como footer fijo bajo las 4 tabs en fix-129-b;
   el owner la quiere eliminada del todo, no reubicada.
4. **Tab "Plantillas" no usa el mismo tratamiento visual que las otras 3.** Alumnos/
   Instructores/Escuela envuelven su contenido en un único `.bento-card`; Plantillas quedó como
   un `<div>` suelto sin esa chrome. Decisión del owner (confirmada, no ambigua tras
   preguntar): envolver TODO el panel de Plantillas en un `.bento-card` igual que las otras 3
   tabs — el grid interno de cards de plantillas se mantiene como grid CSS simple (sin bento
   anidado).

## ACs Afectados

Ninguno formalizado — es feedback de diseño directo del owner sobre fix-129-b (mismo track sin
ACs de negocio, solo layout).

## Cambio

- **Archivo:** `src/app/shared/components/dms-list-content/dms-list-content.component.ts`
  1. `<app-tabs variant="line">` → `variant="segmented"`.
  2. Nuevo `@container` local (mismo patrón `flotaContainer`) en el wrapper `.bento-fill` del
     panel: reemplaza `lg:flex-row`/`lg:basis-2/3`/`lg:basis-1/3` (split de "students") y
     `sm:grid-cols-2 lg:grid-cols-3` (grid de "templates") por clases propias con `@container`
     scopeadas al ancho REAL del panel, no al viewport.
  3. Eliminado el bloque `<app-alert-card title="Permisos DMS">` (footer del panel).
  4. Tab "templates" reestructurada: todo el panel (header + filtro categorías + grid + nota
     "Cómo usar las plantillas") envuelto en un único `.bento-card ... flex flex-col h-full
     min-h-0` con `appCardHover`, mismo patrón que las otras 3 tabs (header `px-5 py-4
     border-b`, contenido scrollable `flex-1 min-h-0 overflow-y-auto`).

## Test de Regresión

- Sin lógica nueva (solo CSS/template) → sin `.spec.ts` obligatorio.
- `npx tsc --noEmit`: sin errores.
- `npx ng build --configuration development`: build completo sin errores (58s).
- `npm run lint:arch`: exit 0, 0 errores.
- `/verify` manual en navegador (`secretaria@test.com`, `/secretaria/documentos`):
  - Tabs `variant="segmented"` confirmadas visualmente: fondo `bg-subtle`, labels siempre
    visibles con scroll horizontal (no colapsan a íconos sueltos).
  - Repro exacto del screenshot del owner: click en "Subir documento" (abre el drawer) →
    `.dms-panel-container` mide 500px real (`@container dmsPanel` < 900px) →
    `.dms-students-split` cambia a `flex-direction: column` automáticamente (confirmado con
    `getComputedStyle`) → tabla de alumnos y "Últimos subidos" se apilan en vez de compartir 2
    columnas angostas. Texto ya NO se superpone (extracción de texto limpia, sin
    "Ver"/"Eliminar" solapados).
  - Con el drawer abierto, `<main>` cae bajo el umbral `lg` de `layoutmain` → el
    `bento-grid--fill-screen-kpi` revierte a su fallback documentado ("bajo lg no aplica nada,
    la página scrollea nativamente") — confirmado que `.shell-content` (el scroller real de la
    shell) tiene scroll propio (`scrollHeight:1697` vs `clientHeight:842`) mientras
    `html.scrollHeight === html.clientHeight` se mantiene. Comportamiento esperado del sistema
    de layout existente, no un caso nuevo introducido por este fix.
  - "Permisos DMS" confirmado ausente de las 4 tabs (extracción de texto sin esa card).
  - Tab "Plantillas" ahora envuelta en `.bento-card` con la misma chrome que
    Alumnos/Instructores/Escuela (header `px-5 py-4 border-b`, filtro de categorías en su
    propia sección con borde, contenido con padding) — confirmado por screenshot.
  - `read_console_messages`: mismos `InvalidStateError` (Transition aborted) preexistentes,
    sin errores nuevos.
