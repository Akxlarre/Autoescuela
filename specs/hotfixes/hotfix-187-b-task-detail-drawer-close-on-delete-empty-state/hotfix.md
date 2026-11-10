# Hotfix: cierre automático al eliminar y empty state canónico en detalle de tarea
> id: hotfix-187-b-task-detail-drawer-close-on-delete-empty-state
> refs: —
> status: done
> closed: 2026-11-10
> created: 2026-11-10

## Problema
Al eliminar una tarea en `TaskDetailModalComponent`, se ejecutaba `tasksFacade.softDelete(t.id)` y `selectTask(null)`, pero nunca se cerraba el drawer lateral (`drawer.close()`). Esto dejaba el drawer abierto mostrando la cabecera anterior (ej. "prueba") y un mensaje crudo y desalineado ("Selecciona una tarea para ver el detalle.") en lugar de cerrarse de inmediato.

## Cambios
1. `src/app/features/tareas/task-detail-modal.component.ts`:
   - En `onDeleteClicked()`: invocar `this.drawer.close()` inmediatamente tras el éxito de `softDelete()`.
   - En `constructor()`: registrar `effect` para cerrar el drawer automáticamente si `task()` pasa a ser `null` (deselección, eliminación concurrente o cambio de vista).
   - En el `@else` del template: reemplazar el texto plano sin estructura por `<app-drawer-form>` con `<app-empty-state>` canónico (ícono `clipboard-list`, centrado vertical y textos del sistema de diseño).
