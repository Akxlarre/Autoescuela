# Hotfix: suavizado y micro-animación de entrada en badges de contador de pestañas
> id: hotfix-185-b-tab-count-badge-pop-in-transition
> refs: —
> status: done
> closed: 2026-11-10
> created: 2026-11-10

## Problema
En `TabsComponent`, cuando los datos de tareas cargan asíncronamente desde Supabase, el badge `.tab-count` se inyecta en el DOM en un solo frame (0ms), expandiendo bruscamente el ancho del botón y provocando un salto visual (Layout Shift) sin suavizado.

## Cambios
1. `src/app/shared/components/tabs/tabs.component.ts`:
   - Agregar micro-animación `tab-badge-in` para `.tab-count` con crecimiento suave de `max-width`, escala y `fade-in` (`0.24s cubic-bezier(0.16, 1, 0.3, 1)`).
   - Añadir `transition-all duration-200` en los botones de pestañas segmentadas para acompañar la expansión del contenedor con fluidez.
   - Respetar `prefers-reduced-motion`.
