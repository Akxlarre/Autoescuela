# Hotfix: Acceso a sedes: "Solo su sede" seleccionado no se ve seleccionado en drawers crear/editar secretaria
> id: hotfix-110-m-acceso-sedes-solo-su-sede-sin-estado-seleccionado
> refs: —
> status: done
> created: 2026-09-30

## Problema
En el toggle "Acceso a sedes", el botón "Solo su sede" seleccionado usa `estado-btn--inactive`, el
estilo gris y apagado pensado para el estado "Inactiva". Seleccionado casi no se distingue de un
botón sin seleccionar, así que parece que no hay ninguna opción elegida. "Todas las sedes"
seleccionado sí se ve bien (`estado-btn--grant`). Detectado por el owner al crear una secretaria
(2026-09-30).

## Cambios
- **Archivo:** `src/app/features/admin/secretarias/admin-secretarias-crear-drawer.component.ts` — "Solo su sede" seleccionado usa el mismo estilo que "Todas las sedes" (celeste de marca), renombrado de `estado-btn--grant` a `estado-btn--selected` porque ya no es exclusivo del grant. Se elimina `estado-btn--inactive`, que en este drawer solo usaba este toggle.
- **Archivo:** `src/app/features/admin/secretarias/admin-secretarias-editar-drawer.component.ts` — mismo cambio. `estado-btn--inactive` se mantiene para el toggle Activa/Inactiva, donde el gris de "Inactiva" es intencional.

## Historial
- 1.ª versión (2026-09-30): clase neutra (borde y texto `--text-primary`). El owner pidió usar el
  mismo estilo de "Todas las sedes": en un selector de dos opciones, "seleccionado" debe verse
  igual en ambas. La regla de marca 3-2-1 no se afecta: solo una opción está seleccionada a la vez.

## Verificación
- Capturas del drawer "Nueva Secretaria" en modo claro y oscuro (Playwright contra :4200): ambas
  opciones seleccionadas se ven iguales (borde, texto y fondo tenue en `--ds-brand`); la no
  seleccionada queda gris. El drawer de editar usa la misma clase y CSS.
- `npm run lint:arch` exit 0, sin avisos sobre los archivos tocados.
