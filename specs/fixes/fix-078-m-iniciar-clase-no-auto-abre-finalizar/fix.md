---
# Fix: al iniciar una clase se abre de inmediato el drawer de Finalizar
> id: fix-078-m-iniciar-clase-no-auto-abre-finalizar
> refs: —
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause

`AdminIniciarClaseDrawerComponent.onSubmit()` (`admin-iniciar-clase-drawer.component.ts:259-274`),
tras `startClass()` exitoso, abre inmediatamente `AdminFinalizarClaseDrawerComponent` en vez de
cerrar el drawer. El usuario (Matías) verificó en `ng serve` (tras fix-076/077, que conectaron el
Dashboard a este mismo flujo real) que esto es confuso: recién se inició la clase (toast "Clase
iniciada") y ya se le pide finalizarla con kilometraje de retorno y calificación, sin que la clase
haya transcurrido. Tiene más sentido cerrar el drawer y dejar que el usuario vuelva a entrar cuando
la clase realmente termine (desde Asistencia B o desde el mismo panel "Clases Actuales", que gracias
a fix-076/077 ya abre el drawer real de Finalizar para clases `in_progress`).

Este componente es compartido por 4 puntos de entrada — Dashboard Admin, Dashboard Secretaria,
Asistencia Clase B Admin y Asistencia Clase B Secretaria — todos afectados por el mismo bug y todos
corregidos con este único cambio.

## ACs Afectados

- Ninguno — fix autónomo, sin spec asociada.

## Cambio

- **Archivo:** `src/app/features/admin/asistencia/admin-iniciar-clase-drawer.component.ts`
  - `onSubmit()`: reemplazar `this.layoutDrawer.open(AdminFinalizarClaseDrawerComponent, ...)` por
    `this.layoutDrawer.close()` tras `startClass()` exitoso.
  - Eliminar el import de `AdminFinalizarClaseDrawerComponent` si queda sin uso en el archivo.

## Test de Regresión

- `admin-iniciar-clase-drawer.component.spec.ts` (si existe) o nuevo test enfocado en `onSubmit()`:
  - `startClass exitoso → cierra el drawer (layoutDrawer.close()), NO abre AdminFinalizarClaseDrawerComponent`.
- Suite completa (`npm run test:ci`): 1468/1468 en verde (1/1 en el nuevo
  `admin-iniciar-clase-drawer.component.spec.ts`).
- `npm run lint:arch`: 0 errores, 165 advertencias (mismas pre-existentes, ninguna nueva).
- `npx tsc --noEmit`: 0 errores.
- Verificación visual: NO ejecutada con Playwright MCP en esta sesión — el usuario (Matías) decidirá
  si la corre en `ng serve`.
