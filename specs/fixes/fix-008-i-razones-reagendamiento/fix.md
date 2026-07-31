# Fix: Razones de reagendamiento (enum + "otro")
> id: fix-008-i-razones-reagendamiento
> refs: ASG-b-040
> status: done
> closed: 2026-07-31
> created: 2026-07-30

## Root Cause
[Heredado de ASG-b-040, a confirmar]: Hoy se reagenda sin registrar por qué. El cliente quiere una lista cerrada de razones (con "otro" + texto libre como escape) para poder ver después qué está causando los reagendamientos. Hallazgo relevante: reagendar una sesión `cancelled`/`no_show` (`AdminAlumnoDetalleFacade.reagendarClasesPenalizadas()`) **recicla in-place la misma fila** de `class_b_sessions`; nunca inserta una fila nueva. Consecuencia: no hay dónde guardar la razón hoy, y si se guarda en la propia fila se pisa cada vez que se reagenda de nuevo.

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
- **Migración SQL** (no incluida como archivo — el usuario prefiere aplicar migraciones manualmente; ver bloque SQL abajo): tabla `class_b_reschedule_history` con `class_session_id`, `enrollment_id`, `old_scheduled_at`, `new_scheduled_at`, `old_instructor_id`, `new_instructor_id`, `reason`, `reason_other`, `registered_by`, `created_at`. RLS calcada del patrón de `class_b_sessions` (admin + secretaria, CRUD).
- **`src/app/core/facades/admin-alumno-detalle.facade.ts`**:
  - `ReagendarPenalizacionPayload` agrega `razon: string` y `razonOtro?: string | null`.
  - Nuevo `RAZON_REAGENDAMIENTO_OPTIONS` (export): médica, laboral, viaje, problema del vehículo, ausencia del instructor, clima, otro.
  - `reagendarClasesPenalizadas()`: antes de reciclar cada fila (que sobrescribe `scheduled_at`/`instructor_id`), hace un `SELECT` previo de esas columnas para poder guardarlas en el historial — es la única oportunidad de capturarlas, porque el `UPDATE` que sigue las pisa. Al final del loop, inserta un batch en `class_b_reschedule_history` con razón + fecha/instructor anterior y nuevo por cada sesión reagendada.
  - Nuevo `loadHistorialReagendamientos(enrollmentId)` — lee el historial ordenado por fecha, mapea `reason` a su label legible vía `RAZON_REAGENDAMIENTO_OPTIONS`, fail-safe (si la query falla, deja el array vacío en vez de romper la ficha del alumno).
  - Se inyectó `AuthFacade` (no estaba antes) para resolver `registered_by`.
- **`src/app/features/admin/alumno-detalle/reagendar-clases-drawer/admin-reagendar-horarios-drawer.component.ts`** (Paso 2 del drawer, donde vive el `onSave()` real): se agregó un selector "Razón del reagendamiento" (obligatorio) + input de texto libre condicional cuando la razón es "Otro". `onSave()` valida ambos antes de llamar al facade.
- **Nuevo componente `AdminHistorialReagendamientosComponent`** (`src/app/features/admin/alumno-detalle/components/historial-reagendamientos/`) — Dumb, análogo a `AdminHistorialPagosComponent`, muestra el historial en la ficha del alumno.
- **`src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts`**: importa y renderiza el nuevo componente; `ngOnInit()` carga el historial después de `initialize()`.
- **`src/app/core/models/ui/alumno-detalle.model.ts`**: nuevo `ReagendamientoHistorialUI`.

### Migración SQL (aplicar manualmente — no se escribió a `supabase/migrations/`)

```sql
CREATE TABLE IF NOT EXISTS class_b_reschedule_history (
  id SERIAL PRIMARY KEY,
  class_session_id INT NOT NULL REFERENCES class_b_sessions(id),
  enrollment_id INT NOT NULL REFERENCES enrollments(id),
  old_scheduled_at TIMESTAMPTZ,
  new_scheduled_at TIMESTAMPTZ NOT NULL,
  old_instructor_id INT REFERENCES instructors(id),
  new_instructor_id INT NOT NULL REFERENCES instructors(id),
  reason TEXT NOT NULL,
  reason_other TEXT,
  registered_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_b_reschedule_history_enrollment_id
  ON class_b_reschedule_history (enrollment_id);

ALTER TABLE class_b_reschedule_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_class_b_reschedule_history ON class_b_reschedule_history
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary'));

CREATE POLICY insert_class_b_reschedule_history ON class_b_reschedule_history
  FOR INSERT WITH CHECK (auth_user_role() IN ('admin', 'secretary'));

CREATE POLICY update_class_b_reschedule_history ON class_b_reschedule_history
  FOR UPDATE USING (auth_user_role() IN ('admin', 'secretary'));

CREATE POLICY delete_class_b_reschedule_history ON class_b_reschedule_history
  FOR DELETE USING (auth_user_role() IN ('admin', 'secretary'));
```

## Test de Regresión
- `src/app/core/facades/admin-alumno-detalle.facade.spec.ts` — extendido `describe('reagendarClasesPenalizadas — RF-053 + fix-008-i (razones)', ...)`: verifica que el SELECT previo captura `scheduled_at`/`instructor_id` viejos antes del UPDATE, que el insert al historial lleva la razón + fechas + instructores correctos, y que `reason_other` solo se guarda cuando `razon === 'otro'`. Nuevo `describe('loadHistorialReagendamientos — fix-008-i', ...)`: mapeo de razón a label y fail-safe ante error de query. (Se agregó `AuthFacade` mock a los 6 `TestBed.configureTestingModule()` del archivo, ya que el facade ahora lo inyecta.)
- `src/app/features/admin/alumno-detalle/reagendar-clases-drawer/admin-reagendar-horarios-drawer.component.spec.ts` (nuevo archivo, 4 tests): bloquea el guardado sin razón, bloquea "otro" sin texto libre, guarda con "otro" + texto (trim), guarda con razón cerrada y `razonOtro: null`.
- Verificación empírica: `npx tsc -p tsconfig.app.json --noEmit` limpio, `ng build --configuration=development` exitoso, `npm run lint:arch` → 0 errores, `npx vitest run` sobre ambos specs → **39/39 verde** (35 + 4).
- Verificación visual pendiente: (a) aplicar la migración SQL de arriba en tu BD local; (b) reagendar una clase penalizada desde la ficha del alumno, confirmar que pide razón (y texto libre si es "Otro"); (c) confirmar que la nueva sección "Reagendamientos" en la ficha del alumno muestra la razón y las fechas correctamente.
