# Hotfix: integración del Premium Drawer Pattern (DrawerContentLoader y Skeletons) en detalle de tarea
> id: hotfix-182-b-task-detail-drawer-premium-loader-skeletons
> refs: —
> status: done
> created: 2026-11-09
> closed: 2026-11-09

## Problema
1. `TaskDetailModalComponent` no implementaba el "Premium Drawer Pattern" del proyecto (`DrawerContentLoaderComponent`).
2. Al abrir el drawer, la carga inmediata del DOM completo competía con la animación GSAP de slide-in (350ms), causando stuttering y pop-in abrupto.
3. No existía estado de carga/esqueletos mientras se resolvían los datos y el hilo de respuestas, provocando que por una fracción de segundo pudiera parpadear un estado vacío falso.

## Cambios
1. `src/app/features/tareas/task-detail-modal.component.ts`:
   - Integrar `DrawerContentLoaderComponent` (`app-drawer-content-loader`) y `SkeletonBlockComponent` (`app-skeleton-block`).
   - Crear template `#skeletons` con esqueleto espejo del drawer (ficha de metadatos, participantes, descripción y burbujas de chat simuladas).
   - Colocar el contenido real dentro de `#content` para que la animación en cascada de GSAP revele el detalle de forma fluida una vez concluido el slide-in.
