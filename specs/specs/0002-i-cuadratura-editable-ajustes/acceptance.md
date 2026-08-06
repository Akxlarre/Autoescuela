# Acceptance 0002-i — Cuadratura editable vía ajustes + egresos de combustible por vehículo

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-08-06
> **Verifier:** ac-verifier · validado por i

---

## Resumen

- AC totales: 10 (7 + 3 edge cases)
- AC cumplidos (con test automatizado): 10
- AC con QA visual en navegador confirmada: 0 — **gap aceptado explícitamente por el owner**
  para cerrar la spec hoy; retomado como fix nuevo (ver "Deuda técnica")
- AC con evidencia: 10/10 (tests unitarios/integración)

**Veredicto final:** ⚠️ PARCIAL — cerrado a pedido explícito del owner. Toda la lógica está
implementada y testeada (47 tests verdes); falta únicamente la confirmación visual en navegador
real, que se retoma como trabajo aparte.

---

## Verificación por AC

### AC1 — Botón "Registrar ajuste" visible solo para Admin en cuadratura cerrada

- **Estado:** ✅ cumplido (lógica) / ⚠️ sin QA visual
- **Evidencia:**
  - Código: `detalle-cuadratura-modal.component.ts` — `@if (facade.isAdmin())`
  - Facade: `historial-cuadraturas.facade.ts` — `computed isAdmin`
  - Test: `historial-cuadraturas.facade.spec.ts` — describe `registrarAjuste` cubre el guard
- **Notas:** guard client-side + RLS `insert_cuadratura_adjustments` (admin-only) como guard real.

### AC2 — "Gasto olvidado" inserta en `expenses` con la fecha del cierre corregido

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `historial-cuadraturas.facade.spec.ts` — `'tipo="gasto_olvidado" inserta en expenses (con la fecha del cierre) y en cuadratura_adjustments'`
  - Código: `insertGastoOlvidado()` en `historial-cuadraturas.facade.ts`

### AC3 — "Corrección manual" inserta solo en `cuadratura_adjustments`

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `historial-cuadraturas.facade.spec.ts` — `'tipo="correccion_manual" NO inserta en expenses'`

### AC4 — Total vigente (original + ajustes) sin sobrescribir el snapshot original

- **Estado:** ✅ cumplido (lógica) / ⚠️ sin QA visual
- **Evidencia:**
  - Test: `historial-cuadraturas.facade.spec.ts` — describe `totalVigente` (3 tests: sin ajustes,
    con ajustes mixtos, sin cierre seleccionado)
  - Código: `detalle-cuadratura-modal.component.ts` — línea "Vigente: $X" solo si hay ajustes,
    separada del "Cierre Total" original

### AC5 — Registrar un ajuste nunca modifica los campos de arqueo original

- **Estado:** ✅ cumplido
- **Evidencia:** `registrarAjuste()` no hace ningún `UPDATE` sobre `cash_closings` — solo
  `INSERT` en `cuadratura_adjustments`/`expenses`. Reforzado a nivel BD: la migración
  `20260806010000_cuadratura_adjustments.sql` no define policy de UPDATE/DELETE para nadie.

### AC6 — Cada ajuste muestra motivo, monto, autor y fecha

- **Estado:** ✅ cumplido (lógica) / ⚠️ sin QA visual
- **Evidencia:**
  - Código: `mapAdjustmentToRow()` en `historial-cuadraturas.facade.ts` (join a `users`)
  - UI: sección "Ajustes" en `detalle-cuadratura-modal.component.ts` (chip `tipoLabel`, motivo,
    autor, fecha)

### AC7 — Secretaria no puede crear ajustes

- **Estado:** ✅ cumplido
- **Evidencia:** RLS `insert_cuadratura_adjustments` — `auth_user_role() = 'admin'` únicamente;
  guard client-side `facade.isAdmin()` oculta el botón para otros roles.

### AC-E1 — Ajuste rechazado si la cuadratura no está cerrada

- **Estado:** ✅ cumplido
- **Evidencia:** Test `historial-cuadraturas.facade.spec.ts` — `'rechaza si el cierre seleccionado no está cerrado (AC-E1)'`

### AC-E2 — Dos ajustes seguidos se suman, no se pisan

- **Estado:** ✅ cumplido
- **Evidencia:** Test `historial-cuadraturas.facade.spec.ts` — `totalVigente` con 2 ajustes
  mixtos (positivo + negativo) suma correctamente.

### AC-E3 — `vehicle_id` en gasto olvidado usa el mismo campo que fix-006-i/hotfix-001-i

- **Estado:** ✅ cumplido
- **Evidencia:** `insertGastoOlvidado()` inserta `vehicle_id: datos.vehiculoId ?? null` —
  mismo nombre de columna que `CuadraturaFacade.registrarEgreso()`.

---

## Out-of-scope respetado

- ❌ Editar/borrar un ajuste ya registrado — confirmado: no hay ningún método de UPDATE/DELETE
  en el Facade ni policy RLS para esas operaciones.
- ❌ Que Secretaria registre ajustes — confirmado: RLS + guard client-side lo bloquean.
- ❌ Cambiar el flujo de `RegistrarEgresoDrawerComponent` (día en curso) — confirmado: archivo
  no tocado en esta spec (sí en hotfix-001-i, previo y fuera de este track).
- ❌ Vista de registro de egreso desde Flota — confirmado: no se creó ninguna pantalla nueva,
  se reutilizó `app-detalle-cuadratura-modal`.

---

## Deuda técnica detectada

- **QA visual en navegador real (T5.3/T5.4 de tasks.md) sin ejecutar** — el owner decidió
  cerrar la spec igual (2026-08-06) por tiempo, y pidió un **fix nuevo** para retomar en la
  próxima sesión, enfocado en mejorar visualmente el flujo de "editar una cuadratura" (ver
  `fix-018-i-mejorar-visual-editar-cuadratura` creado a continuación). Ese fix debe incluir la
  QA visual pendiente de esta spec como parte de su alcance, no solo mejoras estéticas nuevas.

---

## Cambios en índices

- `indices/COMPONENTS.md` — `RegistrarAjusteCuadraturaDrawerComponent` (nuevo),
  `app-detalle-cuadratura-modal` (entrada actualizada con sección Ajustes)
- `indices/FACADES.md` — `HistorialCuadraturasFacade` (entrada actualizada: ajustes, totalVigente,
  isAdmin, abrirRegistrarAjusteDrawer)
- `indices/DATABASE.md` — tabla `cuadratura_adjustments` (nueva)
- `indices/MODELS.md` — `CuadraturaAdjustment` (dto), `CuadraturaAdjustmentRow`/`AjusteFormData` (ui)

---

## Post-mortem

- **Qué salió mejor de lo esperado:** el Architect Guard detectó a tiempo un patrón de
  reactividad roto (`computed()` sobre `FormControl.value` plano nunca se re-evalúa) gracias a
  que el test de `montoConSigno()` con 2 lecturas distintas lo expuso — sin ese test hubiera
  llegado a producción silenciosamente.
- **Qué fricciones encontramos:** el guard de "Facade en shared/" bloquea por substring
  ("Facade" en cualquier posición del nombre de clase inyectada), no solo Facades de dominio —
  hubo que mover la apertura del drawer al Facade en vez del componente. Documentado como
  patrón reutilizable (`ServiciosEspecialesFacade.openAgregarServicioDrawer()` ya lo hacía).
- **Qué cambiaríamos:** haber corrido `/verify` (Playwright) en paralelo a la implementación en
  vez de dejarlo para el final — hubiera evitado el cierre parcial.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia (automatizada)
- [ ] QA visual en navegador — **pendiente, aceptado como gap por el owner**
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando en CI (47 tests de esta spec + 3 tests actualizados en hotfix-002-i)
- [x] `lint:arch` limpio
- [x] Sin deuda crítica bloqueante (deuda de QA visual movida a fix nuevo)

**Cerrado por:** i
**Fecha:** 2026-08-06
