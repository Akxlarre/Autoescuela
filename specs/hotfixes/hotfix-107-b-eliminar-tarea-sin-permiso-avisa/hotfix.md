# Hotfix: eliminar una tarea sin permiso no avisaba nada
> id: hotfix-107-b-eliminar-tarea-sin-permiso-avisa
> refs: ASG-i-035 (checklist 035, S22)
> status: done
> created: 2026-10-20

## Problema
`TasksFacade.softDelete()` llama a la RPC `soft_delete_task`, que devuelve `false` cuando quien la
llama no puede eliminar esa tarea (por ejemplo, ya no está pendiente o la eliminó otra persona). En
ese caso el facade devolvía `false` sin ningún mensaje: el botón no hacía nada visible. Confirmado en
el código (el caso con error sí mostraba "Error al eliminar la tarea").

Fuera de alcance: el botón "Editar" (siempre deshabilitado) queda como está; mostrar o quitar una
edición no implementada es decisión del owner.

## Cambios
- **Archivo:** `src/app/core/facades/tasks.facade.ts` (+ spec): si la RPC devuelve `false`, avisa
  "No puedes eliminar esta tarea: ya no está pendiente o no la creaste tú." y refresca la lista.

## Verificación
- [x] vitest de `tasks.facade` (48); `tsc` y `lint:arch` sin errores.
