# Plan 0012-i — Anticipos y liquidaciones

> **Created:** 2026-11-18
> **Talla:** L (confirmada por Ignacio 2026-11-18). ⚠️ Revisar el plan antes de implementar.
> **Alcance de este plan:** detalle completo de la **fase 1** (AC15–17). Las fases 2–4 quedan
> esbozadas y se detallan aquí mismo al empezar cada una.

## 1. Resumen ejecutivo

Cuatro fases, cada una se sube a main al terminar:

| Fase | ACs | Qué cambia |
|---|---|---|
| **1** | AC15, AC16, AC17 | Anticipos fuera de la Caja; botón "Dar anticipo" por fila; horas exactas |
| 2 | AC1–7, AC-E1/E2/E3 | Tope $300.000 con justificación; descuento sin negativos y arrastre; medio de pago; confirmar "Deshacer" |
| 3 | AC8–11 | Secretaria en Liquidaciones (RLS de lectura, marcar pagado, sin deshacer, export) |
| 4 | AC12–14, AC18 | Auditoría de pagos y anticipos; aviso de meses sin pagar; sueldos en Reportes |

---

## FASE 1 — detalle

## 2. Inventario de impacto

### Archivos a CREAR
- `supabase/migrations/<ts>_spec0012i_f1_anticipos_fuera_de_caja_y_horas_exactas.sql`
- `supabase/tests/caja/0012-i-anticipos-fuera-de-caja.sql` (anticipo en día cerrado: se registra
  y se borra; un gasto en día cerrado sigue bloqueado)
- `supabase/tests/liquidaciones/0012-i-horas-exactas.sql` (3 clases → 2,25)

### Archivos a MODIFICAR

**AC15 — Anticipos fuera de la Caja**
- `src/app/core/facades/cuadratura.facade.ts` — `fetchGastos` deja de leer `instructor_advances`;
  se quita la suscripción Realtime a esa tabla, la rama `advance` de eliminar y la guarda de
  `tipo === 'anticipo'` en `registrarEgreso`.
- `src/app/core/models/ui/cuadratura.model.ts` — se quita el tipo `'advance'` del egreso y
  `'anticipo'` de `EgresoFormData['tipo']`.
- `src/app/shared/components/cuadratura-content/cuadratura-content.component.ts` — sin la
  etiqueta/ícono de anticipo.
- `src/app/features/admin/contabilidad-cuadratura/registrar-egreso-drawer.component.ts` (+ spec) —
  sin la opción "Anticipo", sin el select de instructor, sin `AnticiposFacade`.
- `supabase/functions/generate-cash-closing-report/index.ts` — sin la consulta de anticipos.
- `supabase/tests/caja/fix-445-m-egresos-caja-cerrada.sql`,
  `supabase/tests/rls/fix-044-i-caja-saldo-y-cierre.sql` — se quitan/invierten los casos de
  anticipo (el candado ya no aplica a anticipos).
- `e2e/escrituras-fallidas.spec.ts` — revisar el caso de anticipo desde la Caja, si existe.

**AC16 — "Dar anticipo" por fila**
- `src/app/shared/components/liquidaciones-content/liquidaciones-content.component.ts` — botón por
  fila (vista tabla y vista tarjetas), output `darAnticipo(instructorId)`.
- `src/app/features/admin/contabilidad-liquidaciones/admin-contabilidad-liquidaciones.component.ts`
  y `src/app/features/secretaria/contabilidad-liquidaciones/secretaria-contabilidad-liquidaciones.component.ts`
  — fijan `anticiposFacade.selectedInstructorId` y abren `RegistrarAnticipoDrawerComponent`.
- `src/app/core/facades/liquidaciones.facade.ts` — refresco silencioso tras el anticipo (ya
  escucha `instructor_advances` por Realtime: verificar que basta).

**AC17 — Horas exactas**
- Migración: `instructor_monthly_hours.total_equivalent` → `NUMERIC(6,2)`;
  `recalc_instructor_monthly_hours()` sin `ROUND(…,1)`; recálculo de todas las filas existentes.
- `src/app/core/facades/liquidaciones.facade.ts` — sin `Math.round(x*10)/10`.
- `src/app/shared/components/liquidaciones-content/liquidaciones-content.component.ts` — horas y
  pie con dos decimales (formato es-CL, "2,25"); `totales().horas` suma exacta.
- `supabase/functions/_shared/payroll-totals.ts` (+ test) — `roundPayrollHours` a 2 decimales.
- `supabase/functions/generate-payroll-report/index.ts` — horas con dos decimales en Excel/PDF.
- `src/app/core/utils/` — función pura de formato de horas si no existe una (con spec).

### Archivos a ELIMINAR
- Ninguno.

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `RegistrarAnticipoDrawerComponent` — ya precarga `facade.selectedInstructorId()` (AC16 sin
  drawer nuevo).
- `PagoInstructorModalComponent` — referencia de cómo las páginas de Liquidaciones abren un drawer.

### Facades/Services existentes que extendemos
- `CuadraturaFacade` (se achica), `LiquidacionesFacade`, `AnticiposFacade` (sin cambios de API).

### Componentes/Facades que NO existen y debemos crear
- Ninguno.

### Patrones del catálogo que instancia
- Regla de negocio en la base, con su test → `fix445_egresos_caja_cerrada.sql` + su test.
- Drawer de dominio (organismo) → `registrar-venta-drawer.component.ts`.
- Lógica de negocio en función pura → `chile-time.utils.ts` (formato de horas).
- Edge function con test → `export-special-services`.

### Trampas que aplican
- **DG-114** (candado de caja cerrada): se quita **solo** de `instructor_advances`. Las funciones
  `guard_egreso_en_caja_cerrada()` y `guard_movimiento_caja_cerrada()` siguen protegiendo
  `expenses` (y las demás tablas): se dropean los triggers, no las funciones.
- **fix-243-m / DG** sede del anticipo = sede del usuario del instructor: deja de importar para la
  Caja, sigue importando para Liquidaciones.
- **AP-013**: botón nuevo sin utilities de tamaño sobre `btn-*`.
- **dates.md**: el anticipo sigue con `date` (fecha pura); define el mes en que se descuenta.

## 4. Modelo de datos

### Migración(es) requerida(s) — fase 1 (pseudo-SQL; el SQL final se muestra a Ignacio antes)

```sql
-- AC15: el anticipo ya no es parte de la caja
DROP TRIGGER IF EXISTS trg_instructor_advances_insert_update_caja_cerrada ON public.instructor_advances;
DROP TRIGGER IF EXISTS trg_instructor_advances_caja_cerrada ON public.instructor_advances;

-- AC17: horas exactas
ALTER TABLE public.instructor_monthly_hours ALTER COLUMN total_equivalent TYPE NUMERIC(6,2);
CREATE OR REPLACE FUNCTION recalc_instructor_monthly_hours(...)  -- v_total_eq NUMERIC(6,2), sin ROUND(,1)
UPDATE public.instructor_monthly_hours SET total_equivalent = practical_sessions * 0.75;
```

- Liquidaciones ya pagadas (`instructor_monthly_payments`) **no se tocan**: guardan su monto.
- Cierres ya guardados (`cash_closings`) **no se tocan**.

### RLS
- Sin cambios en fase 1 (la secretaria ya puede insertar anticipos de su sede).

### Modelos UI/DTO
- `cuadratura.model.ts`: se quitan `'advance'`/`'anticipo'`.
- `instructor-monthly-hour.model.ts`: sin cambio de tipo (`number`).

## 5. Arquitectura del feature

### Diagrama de flujo
```
Liquidaciones (admin/secretaria, Smart)
  └─ app-liquidaciones-content (darAnticipo(id)) ──► page: anticiposFacade.selectedInstructorId.set(id)
                                                     layoutDrawer.open(RegistrarAnticipoDrawer)
                                                       └─ AnticiposFacade.registrarAnticipo → instructor_advances
                                                            └─ Realtime → LiquidacionesFacade.refreshSilently

Caja Diaria: CuadraturaFacade.fetchGastos ── solo expenses (sin instructor_advances)
class_b_sessions completed ─trigger─► instructor_monthly_hours.total_equivalent (NUMERIC 6,2)
```

### Capas tocadas
- BD (migración + 2 tests SQL), edge functions (2), facades (2), modelos (1), componentes (5).

## 6. Restricciones aplicables
- [x] Facade estricto, OnPush, `input()`/`output()`, `@if`/`@for`
- [x] Tokens de color, sin `text-base`, AP-013
- [x] `data-llm-action` en el botón nuevo
- [x] SWR/Realtime: no romper el refresco de Liquidaciones
- [x] dates.md
- [x] TDD: spec primero en facades, utils y edge `_shared`
- [x] Tests SQL de la regla de la base (ARCH-37)
- [ ] Notificaciones (sin cambios)

## 7. Plan de testing
- Unit: `cuadratura.facade.spec` (no lee anticipos; totales sin anticipos),
  `registrar-egreso-drawer.component.spec` (sin opción anticipo),
  `liquidaciones.facade.spec` (2,25 h → $11.250), util de formato de horas,
  `payroll-totals.test.ts` (suma 9,75), `liquidaciones-content` (output `darAnticipo`).
- SQL: anticipo en día cerrado se inserta y se borra; gasto en día cerrado sigue bloqueado;
  3 sesiones → 2,25.
- `/verify`: Caja sin anticipos; botón "Dar anticipo" abre el drawer con el instructor; horas con
  dos decimales.
- `npm run test:ci`, `npm run lint:arch` (estricto).

## 8. Riesgos y mitigaciones
- **Cuadraturas viejas vs. nuevas:** un día cerrado antes del cambio incluyó anticipos en su total;
  al re-abrir su vista, la lista ya no los mostrará. Mitigación: los cierres guardan sus totales y
  no se recalculan; se anota en el fix-073 y en DOMAIN-GOTCHAS.
- **Ajuste "gasto olvidado" de un día viejo** no se ve afectado (va por `expenses`).
- **Otros lectores de `total_equivalent`** (`InstructoresFacade`, `InstructorHorasFacade`)
  pasarán a ver 2 decimales: revisar su formato.
- **e2e** que registre anticipo desde la Caja: se ajusta.

## 9. Orden de implementación (fase 1)
1. SQL: migración mostrada a Ignacio → la aplica → tests SQL.
2. AC17: util de horas + specs → facade → contenido → edge payroll.
3. AC15: specs → CuadraturaFacade/modelo → drawer de egreso → contenido → edge de cierre → tests SQL viejos.
4. AC16: output en contenido → páginas.
5. `test:ci`, `lint:arch`, `/verify`, índices → commit/push cuando Ignacio lo pida.

## 10. Estimación
- Fase 1: ~1 día. Total spec: > 3 días.

## Changelog
- 2026-11-18 — plan inicial (fase 1 detallada).
