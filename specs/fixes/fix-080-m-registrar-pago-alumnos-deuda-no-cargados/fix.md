---
# Fix: "Registrar Pago" dice que no hay alumnos con deuda cuando sí los hay
> id: fix-080-m-registrar-pago-alumnos-deuda-no-cargados
> refs: —
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause

`RegistrarPagoDrawerComponent` lee `PagosFacade.alumnosConDeuda()` para el selector de alumno en
"modo global" (`facade.enrollmentSeleccionado() === null`). Ese signal solo se puebla dentro de
`PagosFacade.initialize()` → `fetchAll()` → `fetchAlumnosConDeuda()`. La página de Pagos
(`admin-pagos.component.ts`/`secretaria-pagos.component.ts`) llama `initialize()` en su `ngOnInit`,
por eso ahí funciona. Pero hay 2 puntos de entrada que abren el mismo drawer directamente sin pasar
por esa página — y por lo tanto sin nunca llamar `PagosFacade.initialize()`:

1. `DashboardComponent.handleQuickAction('qa3')` (Admin) — solo llama `seleccionarParaPago(null)`.
2. `SecretariaContabilidadCuadraturaComponent.openIngresoDrawer()` (Caja Diaria) — inyecta
   `CuadraturaFacade`, nunca `PagosFacade`.

El usuario (Matías) verificó en `ng serve` que `alumnosConDeuda()` queda en `[]` (su valor inicial)
en ambos casos, mostrando "No hay alumnos con saldo pendiente" aunque sí existan.

Además, `SecretariaDashboardComponent.handleQuickAction('qa3')` no abre el drawer en absoluto —
navega a `/app/secretaria/pagos` (comportamiento distinto al de Admin), y su botón "Registrar Pago"
no está marcado como `primary` en `heroActions` (`primary: i === 0`, solo el primer botón), a
diferencia de Admin (`primary: a.id === 'qa1' || a.id === 'qa3'`) — por eso se ve outline
(blanco/borde azul) en vez de sólido, inconsistente con Admin.

## ACs Afectados

- Ninguno — fix autónomo, sin spec asociada.

## Cambio

- **Archivo:** `src/app/features/dashboard/dashboard.component.ts`
  - `handleQuickAction('qa3')`: agregar `void this.pagosFacade.initialize();` antes de abrir el
    drawer (además de `seleccionarParaPago(null)`).
- **Archivo:** `src/app/features/secretaria/dashboard/secretaria-dashboard.component.ts`
  - Inyectar `PagosFacade`.
  - `handleQuickAction('qa3')`: reemplazar `router.navigate(['app/secretaria/pagos'])` por el mismo
    patrón de Admin — `pagosFacade.seleccionarParaPago(null)` + `pagosFacade.initialize()` +
    `layoutDrawer.open(RegistrarPagoDrawerComponent, 'Registrar Pago', 'credit-card')` (import ya
    existente en el archivo, actualmente sin uso tras este cambio — se activa).
  - `heroActions` computed: cambiar `primary: i === 0` por `primary: a.id === 'qa1' || a.id === 'qa3'`
    (idéntico a Admin) para que el botón "Registrar Pago" se vea sólido, no outline.
- **Archivo:** `src/app/features/secretaria/contabilidad-cuadratura/secretaria-contabilidad-cuadratura.component.ts`
  - Inyectar `PagosFacade`.
  - `openIngresoDrawer()`: llamar `pagosFacade.initialize()` antes de abrir el drawer.

## Test de Regresión

- `dashboard.component.ts` (Admin): sin spec de componente completo por la limitación de `styleUrl`
  en Vitest (ver fix-076) — se verifica manualmente en `ng serve`.
- Nuevo `secretaria-dashboard.component.spec.ts`:
  - `handleQuickAction("qa3")` llama `pagosFacade.seleccionarParaPago(null)` e `initialize()` de
    forma síncrona.
  - `heroActions` marca `qa1` y `qa3` como `primary` (igual que Admin), `qa2` no. La apertura async
    del drawer (`import().then()`) no se testea por componente completo — se verifica manualmente.
- Nuevo `secretaria-contabilidad-cuadratura.component.spec.ts`: `openIngresoDrawer()` llama
  `pagosFacade.seleccionarParaPago(null)`, `initialize()` y abre el drawer.
- Suite completa (`npm run test:ci`): 1474/1474 en verde (2/2 en el nuevo
  `secretaria-dashboard.component.spec.ts`, 1/1 en el nuevo
  `secretaria-contabilidad-cuadratura.component.spec.ts`).
- `npm run lint:arch`: 0 errores, 165 advertencias (mismas pre-existentes, ninguna nueva).
- `npx tsc --noEmit`: 0 errores.
- Verificación visual: el usuario (Matías) verificará en `ng serve`.
