# Fix: reagendarClasesPenalizadas() no notifica a alumno/instructor
> id: fix-177-m-reagendar-penalizadas-sin-notificacion
> refs: —
> status: done
> closed: 2026-08-14
> created: 2026-08-14

## Root Cause
`AdminAlumnoDetalleFacade` tiene dos caminos para reprogramar una `class_b_session`:
`reprogramarClase()` (drawer de Reprogramar, desde ficha técnica) y
`reagendarClasesPenalizadas()` (drawer "Reagendar Clases", RF-053 — recupera clases
`no_show`/`cancelled`). Ambos hacen el mismo tipo de UPDATE sobre `class_b_sessions`,
pero solo `reprogramarClase()` termina llamando a `notifyClaseReprogramada()` (línea
1391). `reagendarClasesPenalizadas()` hace el UPDATE, inserta el historial en
`class_b_reschedule_history`, muestra el toast de éxito y retorna — nunca notifica.
Es una omisión: el segundo método se escribió después reutilizando el patrón de
persistencia pero sin replicar el paso de notificación.

## ACs Afectados
- Ninguno — fix autónomo (no hay spec formal para "Reagendar Clases"; el comportamiento
  esperado se infiere por paridad con `reprogramarClase()`, que sí notifica).

## Cambio
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts`
- **Qué cambia:** al final de `reagendarClasesPenalizadas()`, por cada clase reagendada,
  notificar al alumno y al instructor asignado (reutilizando/generalizando
  `notifyClaseReprogramada()` o una variante que itere las clases de `seleccion`).
  Fire-and-forget igual que el flujo existente — un fallo de notificación no debe
  revertir ni bloquear el reagendamiento ya confirmado.

## Test de Regresión
- `src/app/core/facades/admin-alumno-detalle.facade.spec.ts > reagendarClasesPenalizadas notifica a alumno e instructor por cada clase reagendada` ✓
