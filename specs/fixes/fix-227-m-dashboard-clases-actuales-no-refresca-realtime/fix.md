# Fix: "Clases Actuales" del dashboard no refresca vía Realtime al iniciar/cerrar una clase en otra pestaña

> id: fix-227-m-dashboard-clases-actuales-no-refresca-realtime
> refs: —
> status: done
> closed: 2026-08-27
> created: 2026-08-27

## Síntoma (reproducido por el usuario — UAT Paquete 4, caso "Clases en vivo")

Con el dashboard abierto en dos pestañas (mismo usuario secretaria): al iniciar una clase Clase B
en la pestaña A, la pestaña B no actualiza "Clases Actuales" (sigue en "Por iniciar") hasta
recargar. El KPI "Clases Hoy" y los ingresos tampoco reaccionan.

## Root Cause (confirmado con Playwright contra la BD real `skvekggejikzxhzsjmkz`)

`DashboardFacade.setupRealtime()` registra **tres** bindings `postgres_changes` en **un solo
canal** (`dashboard-realtime`): `students`, `class_b_sessions`, `payments`.

Sólo `class_b_sessions` estaba en la publicación `supabase_realtime`
(`20260315100000_enable_realtime_class_b_sessions.sql`). `students` y `payments` nunca se
agregaron.

**Cuando un canal Realtime tiene un binding `postgres_changes` a una tabla que no está en la
publicación, el servidor falla ese binding y el canal deja de entregar eventos para TODOS sus
bindings** — incluido el de `class_b_sessions` — aunque el cliente reporte `SUBSCRIBED`.

Evidencia (misma página, cliente supabase-js nuevo, token de la sesión real, PATCH a
`class_b_sessions` vía PostgREST):

| Canal (bindings) | Tablas en `supabase_realtime` | Evento recibido |
|---|---|---|
| `[class_b_sessions]` | sí | ✅ UPDATE |
| `[users, class_b_sessions, tasks]` | las 3 | ✅ UPDATE de class_b_sessions |
| `[students, class_b_sessions, payments]` (= el del dashboard) | sólo class_b_sessions | ❌ 0 eventos |

Descartadas en el camino: no es `REPLICA IDENTITY` (el canal de 1 binding recibe el UPDATE sin
tocar la identidad), no es auth/`setAuth` (el canal anónimo también lo recibe), no es que el
`subscribe()` falle (reporta `SUBSCRIBED` en todos los casos).

## ACs Afectados

Ninguno — hallazgo de UAT, fix autónomo.

## Cambio

- **Archivo nuevo:** `supabase/migrations/20260827160000_enable_realtime_students_payments.sql`
  Agrega `public.students` y `public.payments` a la publicación `supabase_realtime` (DO block
  idempotente, mismo patrón que `20260625120000_enable_realtime_users.sql`). Con las 3 tablas del
  canal en la publicación, los 3 bindings son válidos y el canal entrega eventos — probado arriba
  con el trío `[users, class_b_sessions, tasks]`.

No se toca `DashboardFacade`: el código del canal ya es correcto una vez que las tablas están
replicadas.

## Verificación

- [x] Root cause aislado con Playwright contra la BD real (tabla de evidencia arriba).
- [x] Migración idempotente creada + índices actualizados (`DATABASE.md`, `DOMAIN-GOTCHAS.md` DG-085).
- [x] `dashboard.facade.spec.ts` verde (19/19) — el facade no se tocó.
- [x] `supabase db push` corrido por el owner (2026-08-27).
- [x] Re-test 2 pestañas OK (2026-08-27): cerrar una clase en la pestaña A → se cerró de
      inmediato en la pestaña B, sin recargar.

## Test de Regresión

Migración SQL de configuración de publicación, sin lógica de decisión en TS — no aplica test
unitario. Verificación manual documentada arriba + en el caso UAT (`docs/UAT-PLAN.md`).

## Lección para el harness

La fragilidad "un binding a tabla no-replicada tumba todo el canal" va a `indices/DOMAIN-GOTCHAS.md`
para que el próximo canal multi-tabla nazca con todas sus tablas en `supabase_realtime` (o con un
canal por tabla).
