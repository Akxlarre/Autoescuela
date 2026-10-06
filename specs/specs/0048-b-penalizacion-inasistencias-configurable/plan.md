# Plan 0048-b — Cancelación automática por inasistencias configurable por sede

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (owner, 2026-10-06: "si, dale" sobre la propuesta de 6 puntos; aplicar en la BD queda sujeto a su visto bueno)
> **Created:** 2026-10-06
> **Talla:** M

---

## 1. Resumen ejecutivo

La regla vive en un solo punto: `apply_class_b_absence_penalty()`, que llaman tanto el cron como el
"Ausente" manual. Se agrega una tabla de configuración por sede y la función la consulta antes de
cancelar. La UI es una tarjeta nueva en Ajustes que abre un drawer con un interruptor por sede, y la
pestaña de configuración se reordena en 3 grupos.

## 2. BD — migración `20261006140000_spec0048_branch_absence_penalty_config.sql`

1. **Tabla** `public.branch_absence_penalty_config` (patrón `branch_payroll_config`):
   `branch_id INT PK → branches`, `auto_cancel_enabled BOOLEAN NOT NULL DEFAULT false`,
   `enabled_since TIMESTAMPTZ`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
   `updated_by INT → users`. RLS activada.
2. **Trigger** `trg_branch_absence_penalty_config_stamp` (BEFORE INSERT OR UPDATE): fija
   `updated_at = now()`, `updated_by` = usuario de `auth.uid()` (no confía en el cliente) y
   `enabled_since = now()` cuando el interruptor pasa a `true` (AC4: reactivar fija un T nuevo);
   `NULL` cuando pasa a `false`. `SECURITY DEFINER` + `search_path = ''` (DG-063).
3. **RLS:** SELECT admin y secretaria; INSERT/UPDATE solo admin; sin DELETE (AC6).
4. **Seed:** una fila por sede, desactivada (`ON CONFLICT DO NOTHING`) (AC1).
5. **`apply_class_b_absence_penalty(p_enrollment_id)`** (misma firma, sigue `search_path = ''`):
   - Lee la config de la sede de la matrícula. Sin sede, sin fila o desactivada → **`RETURN -1`**
     sin tocar nada (AC2, AC-E1). `-1` = "regla desactivada" (el cron hace `PERFORM` y lo ignora;
     el facade lo usa para AC-E2).
   - Activada: la misma sentencia de hoy, más `recorded_at >= enabled_since` en las dos patas del
     par (AC3, AC4). Una asistencia con `recorded_at` NULL no cuenta.
6. `mark_end_of_day_class_b_absences()` **no cambia** (AC5): sigue marcando `no_show` + "Ausente" y
   llamando a la penalización, que decide.
7. Prueba `supabase/tests/agenda/spec-0048-b-penalizacion-configurable.sql` (transacciones que se
   deshacen): AC2 (desactivada → -1, nada cancelado), AC3 (activada → cancela), AC4 (par anterior a
   `enabled_since` no cancela; reactivar fija T nuevo), AC6 (secretaria no puede actualizar;
   `updated_by` lo pone el trigger), AC-E1.

## 3. App

| Pieza | Archivo | Nota |
|---|---|---|
| DTO | `core/models/dto/branch-absence-penalty-config.model.ts` | Refleja la tabla |
| UI model | `core/models/ui/absence-penalty-config.model.ts` | `{ branchId, branchName, enabled, enabledSince }` |
| Facade | `core/facades/absence-penalty-config.facade.ts` (+ `.spec.ts`, TDD) | SWR `load()`; `rows` (admin: todas; secretaria: su sede); `canEdit` (admin); `setEnabled(branchId, enabled)` → UPDATE y relee la fila (trae `enabled_since` del trigger); toasts; `catchError` → signal `error` |
| Drawer | `features/admin/configuracion-inasistencias/penalizacion-inasistencias-drawer.component.ts` | Organismo abierto vía `LayoutDrawerFacadeService` (como `TarifaInstructoresDrawerComponent`); `p-toggleswitch` por sede; solo lectura si `!canEdit`; skeleton con `app-skeleton-block` |
| Ajustes | `shared/components/ajustes-drawer/ajustes-drawer.component.ts` | Tarjeta nueva (admin y secretaria) + agrupar la pestaña en "Mis preferencias" / "Reglas de la escuela" / "Catálogos" (AC8). No inyecta el facade nuevo (ARCH-24: el drawer de Ajustes solo puede inyectar Auth/Branch) |
| Asistencia | `core/facades/asistencia-clase-b.facade.ts` `applyAbsencePenalty` | Si la RPC devuelve `-1` y el alumno queda en las alertas de faltas consecutivas → `toast.info` "no se canceló la agenda: la regla está desactivada en esta sede" (AC-E2). (+ test) |
| Asistencia | `asistencia-clase-b.facade.ts` `markAttendance` | El `upsert` manda `recorded_at = now`: hoy, si la fila ya existía, conserva la fecha vieja y la falta no contaría para AC4. (+ test) |

Íconos nuevos, si hacen falta, se registran en `app.config.ts`.

## 4. Grupos de Ajustes (AC8)

- **Mis preferencias:** Modo oscuro, Promociones (alumno).
- **Reglas de la escuela:** Límite de Agenda, Cancelación automática por inasistencias (nuevo),
  Grilla horaria base, Precios de cursos, Tarifa por hora de instructores.
- **Catálogos:** Plantillas de comunicado, Temas de clases prácticas, Descuentos predefinidos.
- **Sin cambio de posición:** Landing pages (va con Reglas), Conmutar sede activa (al final, como hoy).
Cada título de grupo se muestra solo si el rol ve al menos un bloque del grupo.

## 5. Verificación

- `npm run test:ci`, `npm run lint:arch`, `ng build`.
- Prueba SQL de §2.7 + aplicar con aprobación del owner y registrar en `schema_migrations`.
- `/verify`: Ajustes como admin y como secretaria (grupos, drawer, interruptor).

## 6. Riesgos

- **Acceso a la BD bloqueado** (2026-10-06): el MCP de Supabase y la Management API responden
  "FGA Authentication Error". El código de la app y las migraciones se escriben igual; la parte de BD
  (validar, aplicar, prueba) espera a que vuelva el acceso.
- Cambiar el valor de retorno a `-1` afecta solo a los 2 llamadores conocidos (cron con `PERFORM`,
  facade de Asistencia). Verificado con grep.
