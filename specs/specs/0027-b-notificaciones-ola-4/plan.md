# Plan 0027-b — Notificaciones Ola 4: vencimiento de documentos de flota (D3)

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (2026-07-10)
> **Created:** 2026-07-10
> **Talla:** S (1 migración SQL, 0 Angular, reutiliza infraestructura de Ola 1/3 al 100%)

---

## 1. Resumen ejecutivo

D3 agrega notificación persistente in-app para vencimiento de documentos de flota, dirigida al instructor asignado (que hoy no se entera) y también a los admins (para tener historial además de la alerta viva del dashboard). Se resuelve con **1 función SQL nueva `SECURITY DEFINER` invocada por `pg_cron`** — mismo patrón que `auto_transition_promotion_status()`/`auto_transition_theory_cycle_status()`, ya en producción. Reutiliza `alert_config.advance_days` (mismo umbral que ya usa `DashboardAlertsFacade`) y el tipo `document_expiry` (existe desde Ola 1). Cero Angular, cero Edge Functions.

**Hallazgo de índice corregido durante el discovery:** `indices/DATABASE.md` documenta la FK de `vehicle_documents.vehicle_id`/`vehicle_assignments.vehicle_id` como `→ vehicles.vehicle_id` en algunas filas — no existe tal columna. Verificado contra `supabase/migrations/20260301000007_07_vehicles_and_fleet.sql`: todas las FKs reales apuntan a `vehicles(id)` (la PK real de la tabla). Se usa `vehicles.id` en la función; no se corrige el índice en esta spec (fuera de scope, es una fila de reporte, no afecta funcionalidad).

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Contenido |
|------|-----------|
| `supabase/migrations/20260710010000_notify_vehicle_document_expiry.sql` | Función `notify_vehicle_document_expiry()` (`SECURITY DEFINER`) + registro `cron.schedule(...)` |

### Archivos a MODIFICAR

Ninguno.

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

- **Patrón cron existente:** `auto_transition_promotion_status()` (`20260330100000_pg_cron_promotion_status_auto_transition.sql`) — misma estructura: función SQL pura `SECURITY DEFINER`, `cron.schedule('nombre-job', '0 6 * * *', 'SELECT nombre_funcion()')`.
- **Umbral ya configurado:** `alert_config` (`alert_type='document_expiry'`, `advance_days`, `active`) — mismo dato que consulta `DashboardAlertsFacade` (`dashboard-alerts.facade.ts:205-211`). Se lee, nunca se modifica.
- **Tipo de notificación ya existente:** `document_expiry` en `NotificationReferenceType` (`notification.model.ts:6`) desde Ola 1, ya mapea a severidad `warning` y ya tiene label de agrupación ("documentos por vencer", `notification.utils.ts:68`). Cero cambios de modelo.
- **Resolución de destinatario instructor:** `vehicle_assignments` WHERE `vehicle_id=X AND end_date IS NULL` (asignación activa) → `instructor_id` → `instructors.user_id` — mismo tipo de join de 2 saltos que `resolveInstructorUserIds` (Ola 1/2), ahora en SQL puro.
- **Resolución de destinatario admin:** todos los `users` activos con rol `admin` — mismo patrón `notifyRole`-equivalente ya usado en los triggers de Ola 3 (query directa a `users`/`roles`, sin el helper Angular).

### Componentes/Facades que NO se tocan
- `DashboardAlertsFacade` sigue calculando su alerta viva exactamente igual — esta spec no la lee ni la modifica, solo agrega un canal en paralelo (notificación persistente).

---

## 4. Modelo de datos

```sql
CREATE OR REPLACE FUNCTION notify_vehicle_document_expiry()
RETURNS void
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_advance_days INT;
  v_doc RECORD;
  v_instructor_user_id INT;
  v_admin RECORD;
  v_subject TEXT;
  v_message TEXT;
BEGIN
  SELECT advance_days INTO v_advance_days
  FROM public.alert_config
  WHERE alert_type = 'document_expiry' AND active = true
  LIMIT 1;
  v_advance_days := COALESCE(v_advance_days, 30);

  -- Recorre documentos que HOY entran en ventana "por vencer" O vencen HOY.
  -- Cada documento dispara como máximo 1 vez por motivo (fecha exacta, no rango — AC3/AC-E1).
  FOR v_doc IN
    SELECT
      vd.id, vd.vehicle_id, vd.type, vd.expiry_date,
      v.license_plate,
      CASE WHEN vd.expiry_date = CURRENT_DATE THEN 'expired' ELSE 'expiring_soon' END AS reason
    FROM public.vehicle_documents vd
    JOIN public.vehicles v ON v.id = vd.vehicle_id
    WHERE vd.expiry_date = CURRENT_DATE
       OR vd.expiry_date = CURRENT_DATE + (v_advance_days || ' days')::interval
  LOOP
    BEGIN
      IF v_doc.reason = 'expired' THEN
        v_subject := 'Documento vencido';
        v_message := v_doc.type || ' del vehículo ' || v_doc.license_plate || ' venció hoy.';
      ELSE
        v_subject := 'Documento por vencer';
        v_message := v_doc.type || ' del vehículo ' || v_doc.license_plate || ' vence en ' || v_advance_days || ' días.';
      END IF;

      -- Instructor con asignación activa (AC4: si no hay, no falla, solo no agrega esa fila)
      SELECT i.user_id INTO v_instructor_user_id
      FROM public.vehicle_assignments va
      JOIN public.instructors i ON i.id = va.instructor_id
      WHERE va.vehicle_id = v_doc.vehicle_id AND va.end_date IS NULL
      LIMIT 1;

      IF v_instructor_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
        VALUES (v_instructor_user_id, 'system', v_subject, v_message, 'document_expiry', v_doc.vehicle_id, false, true);
      END IF;

      -- Todos los admins activos
      FOR v_admin IN
        SELECT u.id FROM public.users u
        JOIN public.roles r ON r.id = u.role_id
        WHERE r.name = 'admin' AND u.active = true
      LOOP
        INSERT INTO public.notifications (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
        VALUES (v_admin.id, 'system', v_subject, v_message, 'document_expiry', v_doc.vehicle_id, false, true);
      END LOOP;

    EXCEPTION WHEN OTHERS THEN
      -- AC-E3: un error en un documento no aborta el resto de la corrida.
      RAISE WARNING 'notify_vehicle_document_expiry error (document_id=%): %', v_doc.id, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule(
  'notify-vehicle-document-expiry',
  '0 6 * * *',
  $$SELECT notify_vehicle_document_expiry()$$
);
```

**Nota de diseño (AC-E2):** se notifica 1 fila por documento, no agrupada — el panel ya agrupa visualmente 3+ notificaciones del mismo tipo/día (Ola 1, `groupNotifications()`), así que un vehículo con 3 documentos venciendo el mismo día genera 3 filas que el panel colapsa automáticamente.

**Nota sobre `reference_id`:** se usa `vehicle_documents.vehicle_id` (INT, compatible con la columna INT de `notifications.reference_id` — a diferencia del bug de Ola 3 con `tasks.id` UUID, acá no hay problema de tipos).

### RLS

Sin cambios. `SECURITY DEFINER` bypasea el RLS de `notifications`, `vehicle_documents`, `vehicle_assignments`, `users` — mismo patrón que las 4 funciones de Ola 3 y el resto de funciones cron del proyecto.

---

## 5. Arquitectura del feature

```
pg_cron (0 6 * * *, diario)
  → notify_vehicle_document_expiry() [SECURITY DEFINER]
      → lee alert_config.advance_days (mismo umbral que el dashboard)
      → por cada vehicle_documents con expiry_date = hoy O = hoy+advance_days:
          → resuelve instructor activo (vehicle_assignments → instructors.user_id)
          → INSERT notifications (instructor, si existe) + INSERT notifications (cada admin)
                                                                    │ Realtime
                                                                    ▼
                                      NotificationsFacade (sin cambios — ya escucha la tabla base)
                                                                    ▼
                          TopbarComponent → <app-notifications-panel> (instructor Y admin)
```

### Capas tocadas
- **Solo BD.** Cero Angular, cero Edge Functions.

---

## 6. Restricciones aplicables

- [ ] `architecture.md` / `facades.md` / `models.md` / `visual-system.md` / `swr-pattern.md` / `ai-readability.md` — no aplican, cero código Angular
- [x] `notifications.md` — INSERT siempre server-side (función `SECURITY DEFINER`), nunca desde un Dumb component
- [ ] `testing-tdd.md` — no aplica en el sentido Vitest; ver plan de testing SQL abajo
- [x] `database.md` — migración idempotente (`CREATE OR REPLACE FUNCTION`, `cron.schedule` con nombre de job fijo es upsert-safe en pg_cron), documentar en `indices/DATABASE.md` tras aplicar

---

## 7. Plan de testing

- **Sin harness automatizado** (mismo criterio que Ola 3 — sin Docker disponible, se prueba con datos reales vía REST tras aplicar al proyecto remoto, con autorización del owner en cada `db push`).
- **Verificación en vivo:**
  1. Crear/editar temporalmente un `vehicle_documents` de prueba con `expiry_date = CURRENT_DATE` y otro con `expiry_date = CURRENT_DATE + advance_days` (usando el `advance_days` real leído de `alert_config`).
  2. Ejecutar la función manualmente vía REST/RPC (`SELECT notify_vehicle_document_expiry()`) en vez de esperar al cron — permite probar sin depender del horario.
  3. Verificar notificaciones generadas: 1 para el instructor asignado (si existe asignación activa) + 1 por cada admin activo, con el `reason` correcto en el mensaje.
  4. Probar AC4: vehículo sin asignación activa → solo notifica a admins, sin error.
  5. Probar AC-E1: un documento vencido hace tiempo (`expiry_date` muy en el pasado, no exactamente hoy) → NO genera notificación (el filtro es por fecha exacta).
  6. Limpiar: revertir `expiry_date` de los documentos de prueba a su valor original, borrar notificaciones de prueba.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| `alert_config` sin fila activa para `document_expiry` (nunca configurada) | Baja | `COALESCE(v_advance_days, 30)` — mismo default que ya asume `DashboardAlertsFacade` en su código Angular |
| Vehículo con múltiples asignaciones activas simultáneas (dato inconsistente) | Baja | `LIMIT 1` en la resolución de instructor — documentado, no es un caso de negocio válido hoy (una asignación activa por instructor/vehículo, ver índice `idx_one_active_vehicle_per_instructor`) |
| Cron corre pero `pg_cron` no está habilitado en el proyecto | Muy baja | Ya confirmado habilitado y en uso (3+ jobs existentes) |
| Nombre de columna FK incorrecto (el hallazgo de `vehicles.id` vs `vehicles.vehicle_id`) | Resuelto | Verificado contra el SQL real de la migración, no contra el índice |

---

## 9. Orden de implementación

1. Escribir la migración con la función + `cron.schedule`.
2. `supabase db push --dry-run` → confirmar con el owner → aplicar.
3. Verificar en vivo (6 pasos de §7) contra el proyecto remoto, con datos de prueba efímeros.
4. Limpiar datos de prueba.
5. `npm run lint:arch` (sin cambios esperados) + actualizar `indices/DATABASE.md`.
6. `/spec-verify` → `acceptance.md`.

---

## 10. Estimación

**S — menos de 1 día.** Talla pequeña: 1 función, patrón 100% conocido, sin ambigüedad de diseño pendiente.

---

## Changelog

- 2026-07-10 — plan inicial (talla S, alcance reducido a D3 tras discusión de scope de la spec)
