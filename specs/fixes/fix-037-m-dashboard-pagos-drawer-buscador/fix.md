# fix-037-m — Botón "Pagos" del dashboard debe abrir el drawer, no navegar

## Contexto

En el hero del dashboard, el botón "+ Pagos" (quick action `qa3`) actualmente
navega a la vista completa de Pagos (`app/admin/pagos` o
`app/secretaria/pagos`). El dueño pide que, en su lugar, abra directamente el
drawer "Registrar Pago" (el mismo que ya existe en la vista Pagos), igual que
ya ocurre con "Matricular" (`qa1`) y "Agenda" (`qa2`).

Además, el selector de alumno dentro de ese drawer (modo global, sin
matrícula preseleccionada) es un `p-select` que solo lista todos los alumnos
con saldo pendiente (`PagosFacade.alumnosConDeuda()`), sin buscador. Si la
cantidad de deudores crece, esto se vuelve poco usable. Se pide agregar
capacidad de búsqueda por nombre.

## Alcance

1. **`dashboard.component.ts`** — `handleQuickAction()`: reemplazar la rama
   `qa3` (routing) por apertura del drawer `RegistrarPagoDrawerComponent` en
   modo global, siguiendo el mismo patrón que `qa1`/`qa2`:
   - Inyectar `PagosFacade`.
   - Llamar `pagosFacade.seleccionarParaPago(null)` para forzar modo global
     (sin enrollment preseleccionado).
   - `this.layoutDrawer.open(RegistrarPagoDrawerComponent, 'Registrar Pago', 'credit-card')`.

2. **`registrar-pago-drawer.component.ts`** — agregar buscador al `p-select`
   del selector de alumno (modo global): `[filter]="true"` y `filterBy` sobre
   el label (nombre + rut), con `filterPlaceholder="Buscar alumno..."`. La
   data ya está completamente cargada en memoria (`alumnosConDeuda()`), así
   que el filtro de PrimeNG es client-side — no requiere cambios en el
   Facade ni en la query de Supabase.

Este cambio aplica al mismo componente de drawer usado tanto desde el
Dashboard como desde la vista Pagos (es el mismo `RegistrarPagoDrawerComponent`
en ambos casos), así que el buscador beneficia a los dos puntos de entrada
automáticamente.

3. **`dashboard.facade.ts`** — ajuste menor de UX en el mismo botón: el
   `label` de `qa3` pasa de `'Pagos'` a `'Registrar Pago'` (consistente con
   el título del drawer y con el botón de la vista Pagos), el `icon` pasa de
   `'credit-card'` a `'plus'`, y se reordena el array `quickActions` para
   que `qa3` quede inmediatamente después de `qa1` ("Matricular"), dejando
   `qa2` ("Agenda") al final. Los `id` (`qa1`/`qa2`/`qa3`) y su
   `handleQuickAction()` no se tocan.

4. **`dashboard.component.ts`** — `heroActions()` calculaba `primary` por
   posición (`i === 0`, solo el primer botón azul). Como ahora hay dos
   botones que deben verse como CTA primario (mismo estilo `+ Registrar
   Pago` azul de la vista Pagos), se cambia a `primary: a.id === 'qa1' ||
   a.id === 'qa3'`. Esto dentro del límite de la regla 3-2-1 (máx. 2
   elementos interactivos con `var(--ds-brand)` por viewport).

## Acceptance Criteria

- [x] AC0: Al hacer click en el botón "Pagos" del hero del dashboard, se abre
  el drawer "Registrar Pago" en modo global (selector de alumno visible), en
  vez de navegar a la página de Pagos.
- [x] AC1: El selector de alumno dentro del drawer (modo global) permite
  escribir texto para filtrar la lista por nombre/rut.
- [x] AC2: El comportamiento de apertura contextual del drawer desde la
  tabla de deudores en la vista Pagos (`AdminPagosComponent.openDrawer`) no
  se modifica ni se rompe (no se tocó ese método).
- [x] AC3: `tsc --noEmit` sin errores nuevos.
- [x] AC4: El botón dice "Registrar Pago" y aparece inmediatamente a la
  derecha de "Matricular" (antes de "Agenda") en el hero del dashboard.

## Cierre

`npx tsc --noEmit -p tsconfig.app.json` sin errores. `dashboard.component.ts`
ahora abre `RegistrarPagoDrawerComponent` en modo global (`qa3`) en vez de
navegar; se eliminaron los campos `authFacade`/`router` que quedaron sin uso
tras el cambio. El `p-select` de alumno en `registrar-pago-drawer.component.ts`
tiene `[filter]="true"` + `filterBy="label"` (client-side, ya que
`alumnosConDeuda()` está completamente cargado en memoria). Pendiente:
verificación visual en vivo por el dueño (Playwright MCP no disponible en
este entorno).

## Test de regresión

Cambio de un handler de UI (routing → drawer) y una prop de un `p-select`
existente. Verificado con `npx tsc --noEmit -p tsconfig.app.json` (limpio) y
`npx ng build --configuration development` (build AOT completo, sin errores
de compilación de templates — esto habría fallado si el binding
`[filter]`/`filterBy` del `p-select` o la llamada a `PagosFacade`/
`RegistrarPagoDrawerComponent` estuviera mal tipada).

Playwright MCP no está disponible en este entorno (confirmado: no hay
herramientas `mcp__playwright__*` registradas), por lo que la verificación
visual en vivo se hizo manualmente. **Confirmado por el dueño en vivo:**
el botón "Registrar Pago" abre el drawer correctamente, el buscador de
alumno filtra por nombre/rut con bordes redondeados y mensaje en español,
y el botón se ve con ícono "+" y fondo azul en la posición correcta del
hero. Fix cerrado.
