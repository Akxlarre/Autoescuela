# Acceptance — Spec 0053-b (editar una tarea enviada)

> **Fecha:** 2026-10-20 · **Resultado:** ✅ PASA

| AC | Evidencia | Estado |
|---|---|---|
| AC1 | e2e `comunicacion-tareas.spec.ts` "0053-b": el admin (emisor) abre el detalle, "Editar" está habilitado y el formulario abre con el asunto y la descripción cargados | ✅ |
| AC2 | mismo e2e: el destinatario se muestra como texto ("Lola SECRETARIA") y no hay selector (`#t-recipient` ausente); el tipo queda deshabilitado | ✅ |
| AC3 | mismo e2e: "Guardar cambios" → toast "Tarea actualizada", vuelve al detalle con el asunto nuevo; `due_date` = 23:59 de Chile del día elegido. vitest `updateTask` (UPDATE filtrado por `status = 'pending'`) y `taskEditPayload` | ✅ |
| AC4 | mismo e2e: la secretaria ve el asunto nuevo sin recargar y recibe "Tarea modificada: <asunto>". vitest de la notificación | ✅ |
| AC5 | mismo e2e: la destinataria abre la tarea y no tiene "Editar". `canEditTask` (emisor + pendiente) sin cambios | ✅ |
| AC-E1 | vitest: 0 filas actualizadas → "La tarea ya no está pendiente; no se puede editar.", sin notificar | ✅ |
| AC-E2 | e2e: asunto de solo espacios deja "Guardar cambios" deshabilitado (validador también en crear) | ✅ |

Extra verificado: "Cancelar" en modo edición vuelve al detalle (no cierra todo el panel).

**Suite:** `test:ci` 4488 en verde · `lint:arch` sin errores · e2e `comunicacion-tareas.spec.ts` en verde.
