# Plan 0025-m — Anular pagos en vez de borrarlos

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (Matías, 2026-10-13)
> **Created:** 2026-10-13
> **Talla:** L — migración con triggers, ~20 archivos, 3 edge functions. Revisar antes de implementar.

---

## 1. Resumen ejecutivo

Un pago anulado es la misma fila de `payments` con `status = 'anulado'` y tres columnas nuevas
(quién, cuándo, motivo). La BD es la que hace cumplir las reglas (solo admin, motivo obligatorio,
definitivo, día cerrado bloqueado); la app hace un único `UPDATE`. El saldo no requiere cambios:
`recalculate_enrollment_balance()` ya suma solo `paid` y corre en `UPDATE`.

El grueso del trabajo es que cada lectura de `payments` declare qué estados cuenta, con un test
guardián que falle si aparece una lectura nueva sin declararlo.

Orden: migración → criterio único + test guardián → Caja → lecturas que suman → pantallas que
listan → edge functions → verificación.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20261013150000_spec0025_payments_anulacion.sql` | Migración | Columnas, trigger de anulación, bloqueo por día cerrado en la anulación |
| `supabase/tests/rls/spec-0025-m-anular-pagos.sql` | Test SQL | Casos de la sección 7, en sub-bloques que abortan (sin datos residuales) |
| `src/app/core/facades/payments-status-filter.guard.spec.ts` | Test guardián | AC10: toda lectura de `payments` en `src/app` filtra por estado o está en una lista de excepciones con motivo |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `core/utils/payment-status.utils.ts` (+ spec) | `PAYMENT_STATUS_ANULADO`, `PAYMENT_STATUSES_QUE_SUMAN` (`paid`, `completado`), `paymentStatusLabel/Variant` de un pago individual | Criterio en un solo lugar |
| `core/utils/db-error.utils.ts` (+ spec) | Tokens `PAGO_YA_ANULADO`, `ANULAR_SOLO_ADMIN`, `ANULAR_SIN_MOTIVO` | Mensajes claros |
| `core/models/dto/payment.model.ts` | `voided_at`, `voided_by`, `void_reason` | Refleja la tabla |
| `core/models/ui/cuadratura.model.ts` | `IngresoRow.anulacion: { motivo, por, cuando } \| null` | AC2 |
| `core/models/ui/alumno-detalle.model.ts` | `PagoUI.anulacion` | AC4 |
| `core/models/ui/pagos.model.ts` | `PagoReciente.anulacion` | AC5 |
| `core/facades/cuadratura.facade.ts` (+ spec) | `fetchPayments` trae también `anulado`; totales, arqueo y `cerrarCaja` suman solo los vigentes; `eliminarIngreso(row, motivo)` hace `UPDATE` en vez de `DELETE` | AC1, AC2, AC9 |
| `shared/components/cuadratura-content/cuadratura-content.component.ts` | Fila tachada + etiqueta + motivo; sin botón; el contador "Mostrando N ingresos" y la exportación excluyen anulados | AC2 |
| `features/admin/contabilidad-cuadratura/admin-contabilidad-cuadratura.component.ts` | Para `source === 'payment'`: `confirmWithReason` en vez de `confirm` | AC1 |
| `core/facades/pagos.facade.ts` (+ spec) | 4 indicadores con filtro de estado; recientes y estado de cuenta mapean `anulacion` | AC5 |
| `features/admin/pagos/pagos-recientes-drawer.component.ts`, `admin-pago-detalle-drawer.component.ts` y el estado de cuenta | Pintar "Anulado" tachado; opción "Anulado" en el filtro de estado | AC5 |
| `core/facades/reportes-contables.facade.ts` (+ spec) | Filtro de estado | AC6 |
| `core/facades/dashboard.facade.ts` (+ spec) | Filtro en recaudación del mes y del anterior | AC6 |
| `core/facades/dashboard-alerts.facade.ts` (+ spec) | Filtro en el conteo del día | AC6 |
| `core/facades/admin-alumno-detalle.facade.ts` (+ spec) | Las 2 lecturas mapean `anulacion`; `formatPaymentConcept` numera solo los vigentes | AC4 |
| `features/admin/alumno-detalle/admin-alumno-detalle.component.ts` | Fila tachada con motivo, quién y cuándo | AC4 |
| `core/facades/enrollment-payment.facade.ts` (+ spec) | `.neq('status', 'anulado')` antes del `maybeSingle()` | AC-E3 |
| `features/alumno/pagos/alumno-pagos.component.ts` | Etiqueta "Anulado" (hoy cae en "Pendiente") | AC-E5 |
| `supabase/functions/generate-payment-report/index.ts` | Marca "Anulado" y no lo suma | AC7 |
| `supabase/functions/generate-enrollment-sheet/index.ts` | Excluye anulados | AC7 |
| `indices/DATABASE.md`, `FACADES.md`, `UTILS.md`, `MODELS.md`, `DOMAIN-GOTCHAS.md` | Sincronización | Paso 5 |

No cambian (ya filtran por estado, verificado): `generate-financial-report`,
`generate-cash-closing-report`, `exec_dashboard_kpis`, `exec_dashboard_monthly_series`,
`recalculate_enrollment_balance()`. Los conteos de `admin-alumnos*.facade.ts` (previos a borrar un
alumno) siguen contando anulados a propósito: son historial. Van a la lista de excepciones del test.

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

- `ConfirmModalService.confirmWithReason()` (spec 0010-i): modal con motivo obligatorio. No se crea
  un drawer nuevo.
- `assertWriteOk(..., { requireRows: true })` y `toFriendlyDbMessage` (fix-362-m / fix-044-i).
- `guard_movimiento_caja_cerrada` y el token `CAJA_CERRADA` (fix-044-i).
- `app-badge` para la etiqueta "Anulado"; `chileDate` / `formatChileDate` para el "cuándo".
- Patrón del test guardián: `unchecked-writes.guard.spec.ts`.
- Nada nuevo en componentes ni facades.

---

## 4. Modelo de datos

### Migración

```sql
-- 1. Columnas (idempotente)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS voided_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by   INT REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- 2. BEFORE UPDATE en payments: guard_anulacion_pago()
--    a) OLD.status = 'anulado'                        → RAISE 'PAGO_YA_ANULADO' (definitivo)
--    b) NEW.status = 'anulado' (transición):
--         - auth_user_role() <> 'admin'               → RAISE 'ANULAR_SOLO_ADMIN'
--         - btrim(NEW.void_reason) vacío              → RAISE 'ANULAR_SIN_MOTIVO'
--         - día de OLD.payment_date con caja cerrada  → RAISE 'CAJA_CERRADA'
--           (misma consulta que guard_movimiento_caja_cerrada; sin la excepción de 'draft',
--            porque un borrador se borra, no se anula)
--         - NEW.voided_by := usuario de la sesión; NEW.voided_at := now()
--         - el resto de columnas queda igual a OLD (anular no edita montos ni fecha)
--    c) cualquier otro UPDATE: las columnas voided_* no se pueden tocar
```

- `payments.status` es `TEXT` sin `CHECK`: no hay restricción que ampliar.
- `trg_update_balance` (`AFTER UPDATE`) recalcula el saldo en la misma transacción.
- `log_change` ya audita `UPDATE` en `payments`: la anulación queda en `audit_log`.
- Se respeta DG-106 (procesos automáticos: `cleanup_expired_drafts` y
  `confirm_enrollment_with_payment` hacen `DELETE`, no `UPDATE`; el trigger nuevo no los toca) y
  DG-107 (`SET lock_timeout` al crear triggers sobre una tabla con tráfico).

### RLS

Sin cambios de policies. `update_payments` sigue dejando a la secretaria modificar pagos de su
sede; lo que le impide anular es el trigger (b). El borrado sigue siendo solo admin
(`delete_payments`).

### Modelos UI/DTO

Ver tabla de la sección 2. La transformación `voided_*` → `anulacion` ocurre en cada facade.

---

## 5. Arquitectura del feature

```
Admin → AdminContabilidadCuadraturaComponent
          └─ confirmWithReason({ motivo obligatorio })
               └─ CuadraturaFacade.eliminarIngreso(row, motivo)
                    └─ UPDATE payments SET status='anulado', void_reason=… WHERE id=…
                         ├─ BEFORE: guard_anulacion_pago()  (rol, motivo, día cerrado, quién/cuándo)
                         ├─ AFTER:  recalculate_enrollment_balance()
                         └─ AFTER:  log_change()
          └─ refreshSilently() → cuadratura-content pinta la fila tachada

Lecturas que suman → .in('status', PAYMENT_STATUSES_QUE_SUMAN)
Lecturas que listan → traen todo y mapean `anulacion` para pintarlo tachado
```

Los totales de la Caja se calculan en el facade sobre las filas vigentes; el componente recibe la
lista completa (vigentes + anuladas) solo para mostrar.

---

## 6. Restricciones aplicables

- [x] `architecture.md` — la lógica "suma / no suma" va a funciones puras en `core/utils/`
- [x] `facades.md` — branch-scoped y request guards existentes se mantienen
- [x] `models.md` — `anulacion` en modelos `ui/`; columnas nuevas en el `dto/`
- [x] `visual-system.md` — tachado y etiqueta con tokens (`text-text-muted`, `app-badge`); sin colores sueltos
- [x] `swr-pattern.md` — post-anulación con `refreshSilently()`
- [x] `notifications.md` — toasts vía `ToastService`
- [x] `testing-tdd.md` — specs primero en facades y utils
- [x] `ai-readability.md` — `data-llm-action="anular-pago-cuadratura"` en el botón
- [x] `dates.md` — "cuándo" con `formatChileDate`; el día cerrado se compara contra `payment_date`

---

## 7. Plan de testing

- **Test SQL** (`supabase/tests/rls/`): admin anula → saldo recalculado; secretaria → rechazado;
  sin motivo → rechazado; ya anulado → rechazado; día cerrado → `CAJA_CERRADA`; `voided_by` /
  `voided_at` no falsificables desde el cliente; el cron de borradores sigue borrando.
- **Unitarios (TDD)**: `cuadratura.facade.spec.ts` (totales y cierre ignoran anulados; anular hace
  `UPDATE`, nunca `DELETE`; errores sin toast de éxito), `pagos`, `reportes-contables`, `dashboard`,
  `dashboard-alerts`, `admin-alumno-detalle`, `enrollment-payment`, utils.
- **Test guardián** (AC10): en rojo antes de corregir las lecturas, en verde después.
- **Zonas horarias**: `node scripts/test-tz.mjs` sobre los specs tocados que usan fechas.
- **/verify**: Caja como admin y como secretaria, ficha del alumno B y Profesional, Pagos; claro,
  oscuro y móvil. Con un alumno de prueba propio.
- `npm run lint:arch` y `npm run test:ci`.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Se escapa una lectura y un reporte suma un anulado | Media | Test guardián (AC10) + prueba en el piloto con un pago anulado real de un alumno de prueba, revisando cada pantalla del inventario |
| El front se despliega antes que la migración: anular falla por columna inexistente | Media | Orden de despliegue: migración primero. Sin migración, el `UPDATE` falla con error visible, no corrompe nada |
| El trigger frena un `UPDATE` legítimo sobre pagos (otros flujos que actualizan `payments`) | Baja | Inventariar los `UPDATE` a `payments` (app, edge, SQL) antes de escribir el trigger; el trigger solo actúa si OLD o NEW es `anulado` o si cambian las columnas `voided_*` |
| La secretaria no puede leer el nombre de quien anuló (RLS de `users` por sede) | Media | Verificar; si no se puede, resolver el nombre con una columna desnormalizada escrita por el trigger |
| Edge functions desplegadas con la versión vieja siguen sumando anulados | Media | Dejar anotado el comando de despliegue de las 2 funciones; verificar el PDF tras desplegar |
| `formatPaymentConcept` numera cuotas por posición: un anulado corre la numeración | Alta | Numerar solo los vigentes (test) |
| Deadlock al crear el trigger con la app en uso (DG-107) | Baja | `SET lock_timeout = '5s'` y reintento |

---

## 9. Orden de implementación

1. Inventario de `UPDATE`/`DELETE` sobre `payments` y de la visibilidad de `users` para la secretaria.
2. Migración + test SQL (los escribo; **Matías aplica la migración**).
3. `payment-status.utils` + `db-error.utils` + test guardián (en rojo).
4. Caja: facade (TDD) → componente → smart del admin.
5. Lecturas que suman: Pagos, Reportes Contables, dashboard, alertas (guardián en verde).
6. Pantallas que listan: ficha del alumno, Pagos, portal del alumno, paso de pago de la matrícula.
7. Edge functions.
8. `lint:arch`, `test:ci`, `/verify`, índices, `/spec-verify`.

---

## 10. Estimación

L — 2 a 3 días.

---

## Changelog

- 2026-10-13 — plan inicial
