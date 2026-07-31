# Fix: Botón "Registrar egreso" accesible desde el dashboard + atajo de combustible
> id: fix-006-i-registrar-egreso-dashboard-boton
> refs: ASG-b-039
> status: done
> closed: 2026-07-30
> created: 2026-07-30

## Root Cause
[Heredado de ASG-b-039, a confirmar]: el cliente registra egresos a diario y casi siempre son lo mismo (combustible), pero hoy tiene que entrar a Cuadratura para hacerlo. Pide un acceso directo desde el dashboard y que el caso "combustible" sea de un clic. Anotación de la reunión (2026-07-28): "Cuadratura: egresos usualmente puede ser carga de combustible. Dar una opción más accesible para ese egreso en particular. Agregar botón registrar egreso en dashboard."

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
- **Diagnóstico:** `RegistrarEgresoDrawerComponent` (`src/app/features/admin/contabilidad-cuadratura/registrar-egreso-drawer.component.ts`) ya era un componente standalone abierto vía `LayoutDrawerFacadeService.open()` sin acoplamiento a Cuadratura (mismo patrón que `RegistrarPagoDrawerComponent`, que el dashboard ya abre para "Registrar Pago") — no hizo falta moverlo/extraerlo a `shared/`, solo abrirlo desde el dashboard también. No existía ninguna categoría "combustible" en el flujo: `tipoOptions` solo tenía `gasto`/`anticipo`, y `expenses.category` (columna ya existente en BD) nunca se insertaba.
- **`src/app/core/models/ui/cuadratura.model.ts`**: `EgresoFormData.tipo` ahora es `'gasto' | 'anticipo' | 'combustible'`.
- **`src/app/core/facades/cuadratura.facade.ts`**:
  - `registrarEgreso()`: el branch `tipo === 'gasto'` ahora también cubre `'combustible'`, insertando `category: 'combustible'` en `expenses` (antes `category` nunca se insertaba). El branch `anticipo` (`instructor_advances`) queda intacto, sin campo `category`.
  - Nuevo signal público `egresoTipoPreset` (consumido una sola vez) — mismo patrón que `pagosFacade.seleccionarParaPago(null)` para preparar estado antes de abrir un drawer desde fuera de su feature "home".
- **`registrar-egreso-drawer.component.ts`**: se agregó `{ label: 'Combustible', value: 'combustible' }` a `tipoOptions` (primera opción, caso dominante), labels/placeholders específicos en `tipoLabel`/`tipoPlaceholder` para `combustible`, y un `constructor()` que lee `facade.egresoTipoPreset()` al montarse, precarga el form y limpia el preset (consumo único, no persiste entre aperturas).
- **`src/app/core/facades/dashboard.facade.ts`**: nuevo quick action `qa4` ("Registrar Egreso", ícono `wallet`, no-primary — mismo estilo que `qa2` "Agenda" para no romper la regla 3-2-1 de marca: solo `qa1`/`qa3` son `primary`).
- **`src/app/features/dashboard/dashboard.component.ts`**: se inyectó `CuadraturaFacade`, se importó `RegistrarEgresoDrawerComponent`, y se agregó la rama `qa4` en `handleQuickAction()`: `cuadraturaFacade.egresoTipoPreset.set('combustible')` + `layoutDrawer.open(RegistrarEgresoDrawerComponent, 'Registrar Egreso', 'wallet')`.
- No se tocó ninguna migración ni policy RLS — `expenses.category` ya existía y las policies ya cubren admin + secretaria de su sede.

### Ajustes post-QA del usuario (misma sesión, 2026-07-30)

> Nota de alcance: el usuario pidió también conectar el egreso a un vehículo y persistir `vehicle_id`.
> Esa persistencia queda **fuera de este fix** — estaba explícitamente reservada para ASG-b-037
> (bloqueada esperando al cliente, que "consume el formulario y le agrega `vehicle_id`"). Se
> implementó únicamente el selector visual (sin persistir aún), por decisión explícita del usuario.

- **`src/app/core/models/ui/cuadratura.model.ts`**: `EgresoRow` ahora incluye `category: string | null`.
- **`src/app/core/facades/cuadratura.facade.ts`**: `mapExpenseToEgreso()` ahora mapea `e.category` (antes se descartaba pese a que la query ya usaba `select('*')` y lo traía); `mapAdvanceToEgreso()` setea `category: null` explícito.
- **`src/app/shared/components/cuadratura-content/cuadratura-content.component.ts`**: nuevo método `categoryLabel(egreso)` (mapa `combustible→Combustible`, `gasto→Gasto`, fallback a la categoría cruda, `null` si no aplica) — la columna "MOTIVO" ahora antepone la etiqueta de categoría a la descripción libre (ej. "Combustible — crn" en vez de solo "crn").
- **`src/app/features/admin/contabilidad-cuadratura/registrar-egreso-drawer.component.ts`**: se agregó un selector "Vehículo / Patente" (`p-select`, opcional, `formControlName="vehiculoId"`) que consume `FlotaFacade.vehicles()` — cada opción muestra `"{brand} {model} - {licensePlate} (Asignado a: {instructorName} | Sin instructor asignado)"`, reutilizando el campo `instructorName` que `FlotaFacade` ya calcula (vía `vehicle_assignments` con `end_date IS NULL`), sin queries nuevas. El campo se destaca visualmente (fondo `var(--color-primary-muted)`) cuando `tipo === 'combustible'` (`isCombustible()` computed). El valor **no se envía** a `registrarEgreso()` — el form control existe solo para UX, a la espera de ASG-b-037.

## Test de Regresión
- `src/app/core/facades/cuadratura.facade.spec.ts` — nuevo `describe('CuadraturaFacade.registrarEgreso — combustible (fix-006-i)', ...)` con 3 tests: inserta en `expenses` con `category: 'combustible'` cuando `tipo === 'combustible'`; inserta con `category: null` cuando `tipo === 'gasto'` (sin regresión del comportamiento previo); inserta en `instructor_advances` sin campo `category` cuando `tipo === 'anticipo'`. Más 1 test de estado inicial (`egresoTipoPreset` arranca en `null`).
- Verificación empírica: `npx tsc -p tsconfig.app.json --noEmit` limpio, `ng build --configuration=development` exitoso, `npm run lint:arch` → 0 errores, `npx vitest run src/app/core/facades/cuadratura.facade.spec.ts src/app/core/facades/dashboard.facade.spec.ts` → 31/31 verde (23 + 8, sin regresión en tests preexistentes).
- No se agregó test a `dashboard.component.ts` (no tiene `.spec.ts`, y `handleQuickAction()` es solo un `if/else` de navegación sin `computed()`/decisión de negocio — no aplica per `.claude/rules/testing-tdd.md`).
- **Nuevos (ajustes post-QA):** `cuadratura-content.component.spec.ts` (nuevo archivo, 4 tests) cubre `categoryLabel()` — combustible, gasto, null, categoría desconocida. `registrar-egreso-drawer.component.spec.ts` (nuevo archivo, 5 tests) cubre `vehicleOptions()` (con/sin instructor asignado), el preset de tipo consumido al montar, e `isCombustible()`.
- Verificación empírica (ronda 2): `tsc --noEmit` limpio, `ng build` exitoso, `lint:arch` 0 errores, `vitest run` sobre los 4 archivos de spec relacionados (`cuadratura.facade`, `dashboard.facade`, `cuadratura-content.component`, `registrar-egreso-drawer.component`) → **40/40 verde**.
- Verificación visual pendiente: confirmar en el navegador que (a) el botón "Registrar Egreso" del dashboard abre el drawer con "Combustible" preseleccionado y el selector de vehículo destacado; (b) el selector de vehículo muestra el instructor asignado (o "Sin instructor asignado"); (c) en Cuadratura (`/app/admin/contabilidad/cuadratura`), la columna "MOTIVO" ahora muestra la categoría antepuesta a la descripción para los egresos de tipo `expense`.
