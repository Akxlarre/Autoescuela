# Fix: Botón "Registrar Egreso" (qa4) en el dashboard de secretaria no hace nada
> id: fix-124-b-boton-registrar-egreso-secretaria
> refs: —
> status: done
> closed: 2026-08-08
> created: 2026-08-08

## Root Cause

`DashboardFacade.data().quickActions` es compartido entre `DashboardComponent` (admin) y
`SecretariaDashboardComponent` — siempre trae 4 acciones hardcodeadas: `qa1` Matricular,
`qa2` Agenda, `qa3` Registrar Pago, `qa4` Registrar Egreso
([dashboard.facade.ts:289-322](../../../src/app/core/facades/dashboard.facade.ts)).

`SecretariaDashboardComponent.handleQuickAction()` solo maneja `qa1`/`qa2`/`qa3`
([secretaria-dashboard.component.ts:392-412](../../../src/app/features/secretaria/dashboard/secretaria-dashboard.component.ts))
— no hay rama `qa4`, así que el botón "Registrar Egreso" se renderiza (viene de la misma data
que ve admin) pero al hacer clic no pasa nada (botón fantasma, sin error visible).

`DashboardComponent` (admin) sí maneja `qa4`: fija `cuadraturaFacade.egresoTipoPreset.set('combustible')`
y abre `RegistrarEgresoDrawerComponent`
([dashboard.component.ts:485-488](../../../src/app/features/dashboard/dashboard.component.ts)).
Secretaría tiene acceso a Caja Diaria en su propio menú (`/app/secretaria/contabilidad/cuadratura`),
así que el fix es agregar la misma rama a `SecretariaDashboardComponent`, no ocultar el botón.

Hallazgo encontrado durante `/verify` de fix-123-b (rollout app-like de `/secretaria/dashboard`) —
preexistente, no introducido por ese fix (no se tocó `handleQuickAction`).

## ACs Afectados

Ninguno — no hay spec previa para el dashboard de secretaria. Fix autónomo.

## Cambio

- **Archivo:** `src/app/features/secretaria/dashboard/secretaria-dashboard.component.ts`
- **Qué cambia:** agregar rama `else if (actionId === 'qa4')` a `handleQuickAction()`, igual que
  `DashboardComponent`: inyectar `CuadraturaFacade`, fijar `egresoTipoPreset.set('combustible')` y
  abrir `RegistrarEgresoDrawerComponent` (lazy-import, siguiendo el patrón ya usado en `qa1`/`qa2`/`qa3`
  de este mismo archivo — a diferencia de admin, que lo importa estático).

## Test de Regresión

- `.spec.ts`: `secretaria-dashboard.component.spec.ts` — nuevo test
  `handleQuickAction("qa4") (fix-124-b) > fija cuadraturaFacade.egresoTipoPreset en "combustible" de
  forma síncrona`. **10/10 verde.** (Se descartó un segundo test que esperaba la resolución del
  `import()` dinámico de `RegistrarEgresoDrawerComponent` — flaky por el tiempo real de transformación
  del módulo en este entorno; el mismo patrón ya establecido en el test de `qa3` de este archivo
  tampoco lo verifica por unit test.)
- Verificación manual en navegador (real, con sesión `secretaria@test.com`): click en "Registrar
  Egreso" desde `/secretaria/dashboard` → el drawer "Registrar Egreso" abre correctamente (antes: no
  pasaba nada). Consola sin errores nuevos (solo el ruido preexistente de View Transitions del router,
  ajeno a este fix).
- `npm run test:ci` completo: **1876 passed, 5 skipped, 0 failed**.
- `npm run lint:arch`: exit 0 (sin warnings nuevos en el archivo tocado).

## Referencias

- Descubierto durante `/verify` de [fix-123-b-app-like-secretaria-dashboard](../fix-123-b-app-like-secretaria-dashboard/fix.md)

## Archivos involucrados

- `src/app/features/secretaria/dashboard/secretaria-dashboard.component.ts`
