# Hotfix: "Módulo no disponible" muestra "Volver al inicio de sesión" a un admin al recargar
> id: hotfix-092-b-mnd-boton-sesion
> refs: ASG-i-022 (checklist 022, J04 / sospecha S16)
> status: closed
> created: 2026-10-19

## Problema
El texto del botón sale del rol del usuario. Al recargar `/modulo-no-disponible` la sesión todavía
se está restaurando (`currentUser()` = null) y el botón dice "Volver al inicio de sesión" hasta que
llega el perfil: un admin o una secretaria creen que se les cerró la sesión. El clic ya esperaba a
`whenReady`; el texto no.

## Cambios
- **Archivo:** `src/app/features/modulo-no-disponible/modulo-no-disponible.component.ts` (+ spec) —
  `moduloNoDisponibleLabel(action, ready)`: mientras la sesión no esté lista el botón dice
  "Volver"; después, el texto de siempre.

## Verificación
- [x] vitest de la función.
- [x] e2e `auth-sesion-3.spec.ts` J04 (recarga como admin: nunca aparece "inicio de sesión").
