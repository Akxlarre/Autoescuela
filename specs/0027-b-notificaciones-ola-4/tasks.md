# Tasks 0027-b — Notificaciones Ola 4: vencimiento de documentos de flota (D3)

> **Spec:** [spec.md](./spec.md) | **Plan:** [plan.md](./plan.md)
> **Created:** 2026-07-10

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Escribir migración `supabase/migrations/20260710010000_notify_vehicle_document_expiry.sql`
  - **AC ref:** AC1, AC2, AC3, AC4, AC5, AC-E1, AC-E2, AC-E3
  - **DoD:**
    - [x] Función `notify_vehicle_document_expiry()` `SECURITY DEFINER SET search_path = ''`
    - [x] Lee `alert_config.advance_days` (`alert_type='document_expiry'`, `active=true`) con `COALESCE(..., 30)`
    - [x] Filtra `vehicle_documents` por `expiry_date = CURRENT_DATE` O `= CURRENT_DATE + advance_days` (fecha exacta, no rango — AC3/AC-E1)
    - [x] Join a `vehicles` usando `vehicles.id` (NO `vehicles.vehicle_id`, confirmado inexistente contra el SQL real de la migración de flota)
    - [x] Resuelve instructor activo vía `vehicle_assignments.end_date IS NULL` → `instructors.user_id`; si no hay, no falla (AC4)
    - [x] Notifica a todos los `users` con rol `admin` y `active=true`
    - [x] Mensaje distingue "por vencer" vs "venció hoy" e incluye `vehicle_documents.type` + `license_plate`
    - [x] Un `INSERT` por documento×destinatario, sin agrupar (AC-E2)
    - [x] Cada documento envuelto en su propio `BEGIN...EXCEPTION WHEN OTHERS` para no abortar el resto de la corrida (AC-E3)
    - [x] `cron.schedule('notify-vehicle-document-expiry', '0 6 * * *', ...)` al final del archivo

---

## Fase 2 — Aplicación remota

- [x] **T2.1** — `supabase db push --dry-run` y mostrar el resultado al owner antes de aplicar
  - **DoD:**
    - [x] Dry-run muestra únicamente la migración nueva de esta spec (sin arrastrar drift previo — ya resuelto en spec 0026)
    - [x] Confirmación explícita del owner obtenida para el `db push` real (sin `--yes` bypass previo a esa confirmación)
- [x] **T2.2** — Aplicar `supabase db push` tras la confirmación
  - **DoD:**
    - [x] Migración aplicada sin errores
    - [ ] `cron.schedule` registrado (verificar con `SELECT * FROM cron.job WHERE jobname = 'notify-vehicle-document-expiry'` vía REST/RPC si es posible, o confirmación de que el `CREATE`/`SELECT cron.schedule` no arrojó error)

---

## Fase 3 — Verificación con datos reales

- [x] **T3.1** — Preparar datos de prueba efímeros
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [x] Leer `advance_days` real vigente en `alert_config` vía REST — sin fila para `document_expiry` → confirma el fallback `COALESCE(...,30)` en uso real
    - [x] Creados 4 `vehicle_documents` de prueba: SOAP (+30d, `vehicle_id=1`), REVISION (hoy, `vehicle_id=1`), OLD (2026-01-01, lejano, `vehicle_id=1`), NOINSTR (hoy, `vehicle_id=7` vehículo de prueba sin asignación)
- [x] **T3.2** — Ejecutar la función manualmente (RPC) en vez de esperar el cron
  - **DoD:**
    - [x] `POST /rpc/notify_vehicle_document_expiry` → 204 sin error
- [x] **T3.3** — Verificar notificación al instructor asignado (AC1/AC2)
  - **DoD:**
    - [x] `recipient_id=6` (`instructors.id=2`.`user_id`) recibió 2 filas: "Documento por vencer" (SOAP, +30d) y "Documento vencido" (REVISION, hoy) — ids 21 y 23
- [x] **T3.4** — Verificar notificación a todos los admins (AC1/AC2/US3)
  - **DoD:**
    - [x] Único admin activo (`recipient_id=2`) recibió las mismas 2 filas (ids 22, 24) + la del vehículo sin instructor (id 25) — total 3
- [x] **T3.5** — Verificar AC4 (vehículo sin asignación activa)
  - **DoD:**
    - [x] Vehículo de prueba `QATEST1` (id=7, sin `vehicle_assignments`) generó únicamente la notificación al admin (id 25), ninguna a instructor, sin error
- [x] **T3.6** — Verificar AC-E1 (no retroactivo)
  - **DoD:**
    - [x] Documento OLD (`expiry_date=2026-01-01`) NO generó ninguna notificación — total de filas generadas fue exactamente 5 (2 docs × 2 destinatarios + 1 doc × 1 destinatario), ninguna asociada a OLD
- [x] **T3.7** — Limpieza de datos de prueba
  - **DoD:**
    - [x] 5 notificaciones (ids 21-25), 4 `vehicle_documents` (ids 1-4) y el vehículo de prueba (id 7) eliminados vía REST `DELETE`
    - [x] Verificación post-limpieza: 0 notificaciones `document_expiry`, 0 `vehicle_documents`, 0 vehículo de prueba restante

---

## Fase 4 — Validación y cierre

- [x] **T4.1** — `npm run lint:arch`
  - **DoD:**
    - [x] Exit 0, warnings preexistentes no relacionados (ARCH-10/14/16/11 ya en backlog), 0 archivos TS tocados por esta spec
- [x] **T4.2** — Actualizar `indices/DATABASE.md`
  - **DoD:**
    - [x] Nueva fila en "Funciones SQL" documentando `notify_vehicle_document_expiry()` y el cron job asociado
    - [x] Corrección adicional: nota de gobernanza sobre `vehicles.vehicle_id` (bug de documentación heredado, no existe esa columna)
- [x] **T4.3** — Actualizar `indices/NOTIFICATIONS-MAP.md`
  - **DoD:**
    - [x] D3 marcado ✅ implementado (Spec 0027-b) con nombre de función/cron
    - [x] Fila de priorización Ola 4 (§8) marcada ✅ implementada (D3), D2/D4/WhatsApp siguen diferidos/bloqueados
- [x] **T4.4** — `/spec-verify` → `acceptance.md`
  - **DoD:**
    - [x] Los 5 AC + 3 edge cases con evidencia concreta (ids de notificaciones, valores reales verificados)
- [x] **T4.5** — Cerrar spec
  - **DoD:**
    - [x] `spec.md` status → `done`
    - [x] `specs/ROADMAP.md`: mover de "Activa" a "Done" con resumen
    - [x] `specs/.active` vaciado
    - [x] Memoria institucional: nuevo archivo `project_notificaciones_ola4_spec0027.md` + entrada en `MEMORY.md`
