# Hotfix: colisión de paneles en exec-split del dashboard en pantallas reducidas
> id: hotfix-177-b-dashboard-exec-split-col-collision
> refs: —
> status: done
> created: 2026-11-09
> closed: 2026-11-09

## Problema
En el Dashboard Ejecutivo (`/admin/dashboard`), al visualizar pestañas con paneles divididos (como "Alumnos y cartera") en pantallas reducidas (tablet, mobile o contenedor < 1024px donde `isDesktopLayout()` es false):
`.exec-split` pasa a modo columna (`flex-direction: column`), pero sus hijos `.exec-split__item` tenían `flex: 1 1 0; min-height: 280px`. Como el contenido del primer panel (*Estado de alumnos*) supera los 300px, el footer con `mt-auto` ("Aprobación de ensayos") se desbordaba y colisionaba directamente sobre el encabezado del segundo panel (*Cartera por cobrar*), superponiendo texto e íconos.

## Cambios
- **`src/app/features/dashboard/dashboard.component.scss`**:
  Configurar `.exec-split:not(.exec-split--row) > .exec-split__item` con `flex: 0 0 auto; height: auto; min-height: max-content` para que en modo columna cada panel fluya a su altura natural según su contenido, permitiendo que el scroll del contenedor `.bento-fill` maneje la vista sin colisiones. Mantener `flex: 1 1 0; height: 100%` exclusivamente cuando esté activo el modo fila (`.exec-split--row`).

## Verificación
- Compilación en caliente sin errores.
- `npm run lint:arch`: 0 errores.
- Desaparición de la superposición de texto en pantallas reducidas.
