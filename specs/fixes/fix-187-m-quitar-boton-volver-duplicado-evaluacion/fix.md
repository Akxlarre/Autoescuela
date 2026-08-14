# Fix: Botón "Volver" duplicado en el empty-state de Evaluación Práctica
> id: fix-187-m-quitar-boton-volver-duplicado-evaluacion
> refs: fix-186-m-evaluacion-studentid-y-guard-completed (agregó el guard que hizo visible este estado)
> status: done
> closed: 2026-08-14
> created: 2026-08-14

## Root Cause
El estado vacío "Clase no encontrada" de `InstructorEvaluacionComponent` (visible ahora con más
frecuencia tras el guard de status de fix-186-m) usa `<app-empty-state>` con
`actionLabel="Volver"` — un botón redundante: la vista ya tiene un breadcrumb "← Ficha Técnica"
clickeable en la esquina superior izquierda que hace exactamente lo mismo (`goBack()`).

## ACs Afectados
Ninguno — fix autónomo (defecto visual reportado por QA).

## Cambio
- **Archivo:** `src/app/features/instructor/evaluacion/instructor-evaluacion.component.ts`
  - **Qué cambia:** el `<app-empty-state>` de "Clase no encontrada" pierde `actionLabel`,
    `actionIcon` y `(action)` — sin botón "Volver" propio, el breadcrumb superior sigue siendo la
    única vía de retroceso.

## Test de Regresión
Cambio puramente visual (quitar un botón redundante) — sin lógica nueva que amerite test
unitario. Verificación visual: `/verify` (Playwright) confirmando que el empty-state ya no
muestra botón "Volver" y que el breadcrumb superior sigue funcionando.
