# Hotfix: G05/S20 — el drawer de ajuste de cuadratura queda inválido tras un intento fallido
> id: hotfix-009-i-drawer-ajuste-invalido-tras-intento-fallido
> refs: fix-073-i (caso G05 · sospecha S20)
> status: done
> closed: 2026-11-17
> created: 2026-11-17

## Problema
`onSubmit()` agrega `Validators.required` a `efecto` (corrección manual) o a `categoria` (gasto
olvidado) y nunca los quita. Un intento fallido como "Corrección manual" sin elegir Suma/Resta
deja `efecto` requerido; al cambiar a "Gasto olvidado" ese campo se oculta, el form sigue
inválido y "Registrar Ajuste" queda deshabilitado para siempre.

## Cambios
- **Archivo:** `src/app/features/admin/contabilidad-cuadratura/registrar-ajuste-cuadratura-drawer.component.ts` — los validadores condicionales se sincronizan con el tipo (al cambiarlo), no se acumulan en `onSubmit()`.
- **Archivo:** `registrar-ajuste-cuadratura-drawer.component.spec.ts` — test del caso G05.

## Verificación
- `registrar-ajuste-cuadratura-drawer.component.spec.ts`: 2 tests nuevos del caso G05 (fallaban antes del cambio), 17/17 ✓. `npm run lint:arch`: 0 errores.
- Navegador (2026-11-17, admin, cierre del 10-11 sede 1, sin guardar): "Corrección manual" con
  monto y motivo pero sin Suma/Resta → "Registrar Ajuste" deshabilitado; cambiar a "Gasto
  olvidado" + "Combustible" → habilitado (antes quedaba bloqueado); volver a "Corrección manual"
  y elegir "Suma" → habilitado. Se canceló sin registrar nada.
