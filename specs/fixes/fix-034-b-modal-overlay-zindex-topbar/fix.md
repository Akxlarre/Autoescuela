# Fix: modal-overlay-zindex-topbar
> id: fix-034-b-modal-overlay-zindex-topbar
> refs: —
> status: done
> closed: 2026-07-07
> created: 2026-07-07

## Root Cause
`.modal-overlay__wrapper` (creado imperativamente por `ModalOverlayDirective` en
`src/app/core/directives/modal-overlay.directive.ts`, estilos globales en `src/styles.scss`)
no define `z-index`. El topbar (`src/app/layout/topbar.component.ts`) usa
`sticky top-0 z-40`, que crea un contexto de apilamiento con z-index positivo explícito.

Por las reglas de stacking de CSS, un elemento `position:fixed` con `z-index:auto` (categoría
"positioned descendants nivel 0") siempre pinta **debajo** de cualquier elemento con z-index
positivo explícito (categoría "positive z-index"), sin importar el orden en el DOM. Como
resultado, el wrapper del modal (teletransportado a `document.body` por la directiva) cubre
visualmente el sidebar y el `<main>`, pero el topbar queda renderizado por encima del backdrop
oscuro — dando la apariencia de que el fondo "solo cubre el main del layout y no cubre todo el
viewport".

Nota adicional (no forma parte de este fix, documentada para contexto): `ModalOverlayService
.setContainer()` nunca se invoca en código real de la app (solo en su propio `.spec.ts`); el
README del directive documenta que "el MainLayout registra el contenedor" pero eso no está
implementado. El fallback `this.overlay.container() || this.doc.body` (ya presente sin
commitear en el working tree) es lo que efectivamente mueve el modal a `body`. Ese fallback es
correcto y no se toca en este fix — el bug reportado es puramente de z-index/stacking.

## ACs Afectados
Ninguno — fix autónomo (bug visual de canon, reportado manualmente por el usuario en el modal
de archivar de Base Alumnos B).

- AC-1: `.modal-overlay__wrapper` en `src/styles.scss` define un `z-index` explícito mayor al
  `z-40` del topbar, igualando el tier de "overlay global" ya usado por el modal de
  confirmación de `AppShellComponent` (`z-70`).
- AC-2: El modal `app-eliminar-alumno-modal` (y cualquier otro modal que use
  `[appModalOverlay]`) cubre visualmente el 100% del viewport, incluido el topbar, al abrirse
  en cualquier breakpoint.

## Cambio
- **Archivo:** `src/styles.scss`
- **Qué cambia:** agrega `z-index: 70;` a la regla `.modal-overlay__wrapper`, dándole al
  wrapper teletransportado un nivel de apilamiento explícito que gana contra el `z-40` del
  topbar (mismo tier que el overlay global existente en `AppShellComponent`).

## Test de Regresión
- Verificación visual (Playwright/manual): abrir el modal de archivar en Base Alumnos B
  (`/app/admin/alumnos`) y confirmar que el backdrop cubre la franja del topbar por completo
  (sin banda blanca superior). No aplica test unitario — es CSS de un nodo creado
  imperativamente fuera de la encapsulación de Angular.
