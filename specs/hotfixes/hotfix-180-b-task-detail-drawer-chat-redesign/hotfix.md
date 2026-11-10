# Hotfix: rediseño del drawer de detalle de tarea y modernización del hilo de chat
> id: hotfix-180-b-task-detail-drawer-chat-redesign
> refs: —
> status: done
> created: 2026-11-09
> closed: 2026-11-09

## Problema
1. `TaskDetailModalComponent` (`src/app/features/tareas/task-detail-modal.component.ts`) no utiliza el shell canónico `DrawerFormComponent` (`app-drawer-form`). Los elementos flotan crudos sobre el fondo gris del host de layout.
2. Doble título y doble ícono: el encabezado del `LayoutDrawer` ya renderiza el ícono, título y botón de cierre, y el cuerpo del modal repite un `<h2>` con el mismo título e ícono, consumiendo espacio vertical valioso.
3. Botones de acción flotantes en medio del scroll: "Eliminar", "Editar", "Iniciar" y "Completar" están sueltos entre la descripción y las respuestas, en lugar de residir en el footer fijo del drawer (`[drawer-form-footer]`).
4. Hilo de respuestas deficiente (`TaskReplyThreadComponent`):
   - Muestra "Otro" en lugar del nombre real del remitente o destinatario de la tarea.
   - Carece de avatares con iniciales y estilo de burbuja conversacional moderno alineado a tokens del Design System.
   - El scroll tiene un `max-height: 260px` arbitrario y el textarea carece de soporte para envío rápido con `Ctrl+Enter`.

## Cambios
1. `src/app/features/tareas/task-detail-modal.component.ts`:
   - Envolver el cuerpo en `<app-drawer-form>`.
   - Limpiar el doble header, dejando una tarjeta de metadatos de la tarea (remitente -> destinatario con avatares o badges, fecha límite, tipo y antigüedad).
   - Mover los botones de acción (`Iniciar`, `Completar`, `Editar`, `Eliminar`) al slot `[drawer-form-footer]`.
   - Pasar los nombres del emisor y destinatario a `TaskReplyThreadComponent`.
2. `src/app/shared/components/task-reply-thread/task-reply-thread.component.ts`:
   - Resolver el nombre real del autor de cada respuesta (`Tú`, `senderName`, `recipientName`, o fallback con rol) y mostrar avatar con iniciales.
   - Rediseñar las burbujas de mensaje usando tokens semánticos del Design System (`bg-surface`, `bg-subtle`, `border-border-subtle`, `text-primary`).
   - Soportar `(keydown.control.enter)` / `(keydown.meta.enter)` para enviar respuestas de forma fluida.
   - Pulir el banner de tarea completada y el estado vacío cuando no hay respuestas.
