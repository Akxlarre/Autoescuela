# Plan 0010-i — Clase 7 bloqueada sin el segundo pago (con habilitación rápida y forzado)

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-10-13
> **Talla:** L en total (BD + 2 caminos de inicio + edge function + notificaciones). Se ejecuta en
> dos entregas (decisión de Ignacio, 2026-10-13): **Entrega 1 = M** (AC1–AC6, AC10, AC-E1–E4, AC-E6),
> **Entrega 2 = S/M** (AC7–AC9, AC-E5). Este plan detalla la Entrega 1; la 2 queda esbozada en §11.

---

## 1. Resumen ejecutivo

Un trigger `BEFORE UPDATE` en `class_b_sessions` rechaza con `PAGO_PENDIENTE_CLASE_7` el paso de una
clase 7+ de `scheduled` a `in_progress`/`completed` si la matrícula tiene saldo y no fue habilitada a
mano. La habilitación vive en una tabla nueva, solo inserción, que dispara el aviso a los admins y
queda en la Auditoría. En la UI, el drawer único "Iniciar Clase Práctica" consulta el estado de pago y,
si está bloqueada, ofrece "Registrar pago" (drawer de pago existente apilado) o "Habilitar sin pago"
con motivo. Si la clase está habilitada sin pago y sigue la deuda, al iniciarla se avisa a las
secretarias de la sede (AC10, en BD para cubrir también la app del instructor).

---

## 2. Inventario de impacto (Entrega 1)

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20261013120000_spec0010i_bloqueo_clase7_pago_pendiente.sql` | Migration | Tabla `enrollment_payment_overrides` + RLS + trigger de bloqueo + aviso a admins + aviso a secretarias (AC10) + `trg_audit_*` |
| `supabase/tests/rls/0010-i-bloqueo-clase7.sql` | Test SQL | AC1, AC2, AC-E1–E4, AC5 (registro), AC10, en sub-bloques que abortan (patrón fix-044-i) |
| `src/app/core/models/dto/enrollment-payment-override.model.ts` | DTO | Mapea la tabla nueva |
| `src/app/core/models/ui/estado-pago-clase.model.ts` | UI model | `EstadoPagoClase = { estado: 'libre' \| 'bloqueada' \| 'habilitada_sin_pago'; saldo: number }` |
| `src/app/core/utils/estado-pago-clase.utils.ts` (+ `.spec.ts`) | Util pura | `resolverEstadoPagoClase(classNumber, saldo, habilitada)`: misma regla que el trigger, testeable sin Angular |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/facades/asistencia-clase-b.facade.ts` (+ spec) | `cargarEstadoPagoClase(row)` → signal `estadoPagoClase`; `habilitarSinPago(enrollmentId, motivo)` con `assertWriteOk` | AC3, AC5, AC-E6 |
| `src/app/features/admin/asistencia/admin-iniciar-clase-drawer.component.ts` (+ spec) | Banda "Bloqueada: pago pendiente $X" / "Habilitada sin pago — debe $X"; botones "Registrar pago" y "Habilitar sin pago" (motivo inline); "Iniciar" oculto si bloqueada; relee estado en `ngOnInit` (al volver del pago se re-instancia) | AC3, AC4, AC5, AC10 |
| `src/app/core/facades/pagos.facade.ts` | Nada nuevo: se usa `seleccionarParaPago()` + `RegistrarPagoDrawerComponent` con `layoutDrawer.push()` | AC4 (reutilización) |
| `src/app/core/utils/db-error.utils.ts` (+ spec) | Token `PAGO_PENDIENTE_CLASE_7` → "Pago pendiente: el alumno debe pasar por secretaría." | AC6 y respaldo de AC1 en la UI |
| `src/app/core/facades/instructor-clases.facade.ts` (+ spec) | `startClass()` usa `toFriendlyDbMessage` antes del sanitizer para conservar el mensaje del token | AC6 |
| `indices/DATABASE.md`, `indices/FACADES.md`/`SERVICES.md`, `indices/COMPONENTS.md`, `indices/DOMAIN-GOTCHAS.md` | Documentar tabla, trigger, métodos y gotcha | Sincronizar |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|
| — | — |

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `AdminIniciarClaseDrawerComponent` — es el **único** drawer de inicio para Asistencia admin,
  Asistencia secretaria, `daily-agenda-drawer` y `secretaria-dashboard`: un solo lugar para la UI.
- `RegistrarPagoDrawerComponent` — precarga por `PagosFacade.seleccionarParaPago(enrollmentId)` (mismo
  patrón que la ficha del alumno). Al guardar hace `layoutDrawer.back()`, que vuelve al drawer de
  inicio y lo re-instancia → `ngOnInit` relee el estado de pago (AC4 sin recargar).
- `app-icon`, `.micro-label`, `.btn-primary`/`.btn-secondary`, banda de aviso con tokens de estado.

### Facades/Services existentes que extendemos
- `AsistenciaClaseBFacade` — estado de pago de la clase seleccionada + habilitar sin pago.
- `toFriendlyDbMessage()` — token nuevo, mismo patrón que `CAJA_CERRADA`.
- Patrón de aviso a secretarias de la sede: `notify_class_b_completed()` (fix-148).

### Componentes/Facades que NO existen y debemos crear
- Ninguno de UI. El motivo se pide **inline** en el drawer (textarea + confirmar):
  `ConfirmModalService` no tiene campo de texto y no se justifica un modal nuevo para un caso.

---

## 4. Modelo de datos

### Migración(es) requerida(s)

```sql
-- 20261013120000_spec0010i_bloqueo_clase7_pago_pendiente.sql  (pseudo-SQL)
SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.enrollment_payment_overrides (
  id            BIGSERIAL PRIMARY KEY,
  enrollment_id INT NOT NULL REFERENCES public.enrollments(id),
  kind          TEXT NOT NULL CHECK (kind IN ('clases', 'certificado')),
  reason        TEXT NOT NULL CHECK (length(trim(reason)) >= 5),
  pending_at_override INT NOT NULL,          -- saldo en el momento (constancia)
  created_by    INT NOT NULL REFERENCES public.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 'clases' se usa en la Entrega 1; 'certificado' en la 2 (mismo registro, AC8).

-- Bloqueo (AC1, AC2, AC-E1–E3)
CREATE FUNCTION public.block_class_b_without_second_payment() RETURNS trigger
  SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.status NOT IN ('in_progress','completed') AND NEW.status IN ('in_progress','completed')  -- DG-110
     AND NEW.class_number >= 7
     AND (SELECT pending_balance FROM public.enrollments WHERE id = NEW.enrollment_id) > 0
     AND NOT EXISTS (SELECT 1 FROM public.enrollment_payment_overrides
                     WHERE enrollment_id = NEW.enrollment_id AND kind = 'clases')
  THEN RAISE EXCEPTION 'PAGO_PENDIENTE_CLASE_7' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_block_class_b_without_second_payment
  BEFORE UPDATE OF status ON public.class_b_sessions FOR EACH ROW
  EXECUTE FUNCTION public.block_class_b_without_second_payment();

-- AC10: al pasar a in_progress una clase 7+ habilitada sin pago y con deuda → aviso a secretarias
--       de la sede (AFTER UPDATE, SECURITY DEFINER, EXCEPTION WHEN OTHERS → WARNING: nunca aborta).
-- AC5: AFTER INSERT en overrides → notificación a todos los admins activos (alumno, monto, motivo).
-- Auditoría: CREATE TRIGGER trg_audit_enrollment_payment_overrides ... EXECUTE FUNCTION log_change();
```

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `enrollment_payment_overrides` | admin | SELECT / INSERT | `auth_user_role() = 'admin'` |
| `enrollment_payment_overrides` | secretary | SELECT / INSERT | matrícula de su sede (`enrollments.branch_id = auth_user_branch_id()`), `created_by = auth_user_id()` |
| `enrollment_payment_overrides` | todos | UPDATE / DELETE | sin policy (solo inserción, igual que `consents`) |

`instructor`/`student`: sin acceso. El trigger de bloqueo es `SECURITY DEFINER`, así que lee la tabla
aunque quien inicia la clase sea el instructor.

### Modelos UI/DTO

- `core/models/dto/enrollment-payment-override.model.ts` — tabla nueva.
- `core/models/ui/estado-pago-clase.model.ts` — lo que pinta el drawer.

---

## 5. Arquitectura del feature

```
Secretaria/Admin → (Asistencia | dashboards) → AdminIniciarClaseDrawerComponent  [Smart, features/]
                      ├─ ngOnInit → AsistenciaClaseBFacade.cargarEstadoPagoClase(row)
                      │              └─ enrollments.pending_balance + overrides(kind='clases')
                      │                 → resolverEstadoPagoClase() (util pura)
                      ├─ "Registrar pago" → PagosFacade.seleccionarParaPago(eid)
                      │                     → layoutDrawer.push(RegistrarPagoDrawer) → back() → ngOnInit
                      ├─ "Habilitar sin pago" (motivo) → facade.habilitarSinPago() → INSERT overrides
                      │                                   └─ trigger BD → notificación admins + audit_log
                      └─ "Iniciar" → facade.startClass() → UPDATE class_b_sessions
                                                           └─ trigger BD: bloqueo / aviso AC10

Instructor → InstructorClaseComponent → InstructorClasesFacade.startClass()
                                         └─ mismo trigger → PAGO_PENDIENTE_CLASE_7 → toFriendlyDbMessage
```

### Capas tocadas

- **Smart**: `features/admin/asistencia/admin-iniciar-clase-drawer.component.ts`
- **Facade**: `asistencia-clase-b.facade.ts`, `instructor-clases.facade.ts`
- **Utils**: `estado-pago-clase.utils.ts`, `db-error.utils.ts`
- **Migration**: `20261013120000_spec0010i_bloqueo_clase7_pago_pendiente.sql`

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — Facade, OnPush, Signals; regla de negocio en util pura
- [x] `facades.md` — `assertWriteOk` en el INSERT del forzado; el drawer no toca Supabase
- [x] `models.md` — DTO de la tabla vs UI model del estado
- [x] `visual-system.md` — tokens de estado para la banda, `app-icon`, sin colores sueltos
- [ ] `swr-pattern.md` — el estado de pago es "solo fetch" por clase seleccionada
- [x] `notifications.md` — avisos en BD (tabla `notifications`); toasts vía `ToastService`
- [x] `testing-tdd.md` — specs de util, facades, drawer y `db-error.utils`
- [x] `ai-readability.md` — `data-llm-action` en "Registrar pago" y "Habilitar sin pago"
- [x] `dates.md` — sin fechas de negocio nuevas; `created_at` es un instante

---

## 7. Plan de testing

- **Unit:** `resolverEstadoPagoClase` (clase 6/7/12, saldo 0/>0, habilitada sí/no);
  `toFriendlyDbMessage` con el token; `AsistenciaClaseBFacade.habilitarSinPago` (motivo vacío no
  llama, error → no marca habilitada: AC-E6); drawer (banda, botones, "Iniciar" oculto, relee en init);
  `InstructorClasesFacade.startClass` devuelve el mensaje claro (AC6).
- **SQL (BD del piloto, sub-bloques que abortan):** AC1, AC2, AC-E1 (pago parcial), AC-E2 (pago
  `pending`), AC-E3 (`in_progress→completed` y `no_show` libres), AC-E4 (secretaria de otra sede,
  simulando su JWT), AC5 (fila + notificación a admins), AC10 (notificación a secretarias).
- **QA en navegador (Playwright, rutas interceptadas para no escribir en la BD compartida):** AC3,
  AC4 (pago → vuelve al drawer → "Iniciar" disponible), AC5 (motivo obligatorio), AC6 en la app del
  instructor.
- `npm run test:ci`, `npm run lint:arch`, `node scripts/test-tz.mjs` si se toca algo con fechas.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Algún flujo pasa una clase de `scheduled` directo a `completed` y queda bloqueado sin explicación | Baja | Revisado el 2026-10-13: los 4 `status: 'completed'` del front (`finishClass` ×2, evaluación del instructor, finalizar de Asistencia) parten de una clase ya iniciada. El trigger cubre `completed` igual para que no se salte el bloqueo; el token se traduce en `toFriendlyDbMessage` |
| `ngOnInit` al volver del pago pierde el km tecleado | Media | Se re-precarga desde `vehicles.current_km` (ya es el default); aceptable |
| `log_change()` muestra la tabla nueva con etiqueta genérica `id=X` | Alta | Aceptable en la Entrega 1 (el motivo y el monto van en la notificación al admin); mejorar `entity_label` solo si Ignacio lo pide |
| La Auditoría solo lista acciones de secretarias (no las del admin) | Alta | Ya documentado (DATABASE.md, `log_change` (14)); el forzado del admin queda en `audit_log` y en la tabla nueva igual |
| Matrículas en curso quedan bloqueadas al aplicar la migración | Baja | Decidido: sin tratamiento especial (spec §9) |
| Aplicar el trigger con clases en curso en el piloto | Baja | `SET lock_timeout='5s'` y reintento (DG-107) |

---

## 9. Orden de implementación (Entrega 1)

1. SQL en el chat → Ignacio lo revisa → archivo de migración → Ignacio lo aplica en el SQL Editor.
2. Test SQL (`supabase/tests/rls/0010-i-bloqueo-clase7.sql`) → Ignacio lo corre → todo ✅.
3. Util pura + spec (TDD) y token en `db-error.utils` + spec.
4. DTO + UI model.
5. `AsistenciaClaseBFacade` (+ spec) e `InstructorClasesFacade` (+ spec).
6. Drawer de inicio (+ spec).
7. `npm run test:ci` + `npm run lint:arch` + QA Playwright.
8. Índices + acceptance.md parcial (Entrega 1).

---

## 10. Estimación

Entrega 1: M (1–2 días). Entrega 2: S/M (1 día).

---

## 11. Entrega 2 (esbozo — se detalla al terminar la 1)

- **AC7:** nueva versión de `notify_deposit_reminder()` sin la condición `payment_mode = 'partial'`
  + aviso a secretarias de la sede y admins.
- **AC8 / AC-E5:** `generate-certificate-b-pdf` exige `pending_balance <= 0` o una fila
  `enrollment_payment_overrides(kind='certificado')` **posterior**; si no, 409 con el monto. La UI
  (`CertificacionClaseBFacade` + ficha del alumno) pide confirmación con motivo, inserta el override y
  reintenta. `generarPendientes()` salta a los alumnos con deuda y los cuenta. El forzado por clases
  incompletas (`force`, solo admin) no cambia.
- **AC9:** texto de `public-enrollment.component.ts` (~línea 792).

---

## Changelog

- 2026-10-13 — plan inicial
- 2026-10-13 — el bloqueo vigila toda entrada a iniciada/completada, no solo desde `scheduled` (hueco `no_show → in_progress` hallado al escribir el test SQL, DG-110)
