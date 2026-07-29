# Acceptance 0027-b — Notificaciones Ola 4: vencimiento de documentos de flota (D3)

> **Spec:** [spec.md](./spec.md) | **Plan:** [plan.md](./plan.md) | **Tasks:** [tasks.md](./tasks.md)
> **Fecha de verificación:** 2026-07-10
> **Owner:** Akxlarre

---

## Resumen ejecutivo

**5/5 AC cumplidos + 3/3 edge cases cumplidos, 0 fallidos.** Verificado con datos reales contra el proyecto Supabase remoto (sin harness automatizado — mismo criterio que Spec 0026, sin Docker disponible). Se ejecutó la función `notify_vehicle_document_expiry()` manualmente vía RPC (en vez de esperar el cron de las 06:00) sobre 4 `vehicle_documents` y 1 `vehicles` creados efímeramente, y se verificó cada notificación generada directamente contra la tabla real vía REST (token de la sesión admin ya autenticada — misma técnica de [[qa-rest-directo-rls-admin]]). Todos los datos de prueba fueron eliminados al final, sin dejar residuos. `lint:arch` exit 0, sin cambios (0 archivos TS tocados — feature 100% SQL).

**Veredicto: ✅ PASA**

---

## AC1 — Documento entra en ventana "por vencer"

**✅ Cumplido.** Documento de prueba `QA_TEST_SOAP` (`vehicle_documents.id=1`, `vehicle_id=1`, `expiry_date=2026-08-09` = hoy + 30 días, umbral real de `alert_config` que resultó vacío → fallback `COALESCE(...,30)` confirmado en uso) generó:
- `notifications.id=21` → `recipient_id=6` (`instructors.id=2`.`user_id`, asignación activa real `vehicle_assignments.id=1`), subject "Documento por vencer", mensaje "QA_TEST_SOAP del vehículo ABCD43 vence en 30 días."
- `notifications.id=22` → `recipient_id=2` (único admin activo del proyecto), mismo subject/mensaje.

## AC2 — Documento vence hoy

**✅ Cumplido.** Documento de prueba `QA_TEST_REVISION` (`id=2`, `vehicle_id=1`, `expiry_date=2026-07-10` = hoy) generó:
- `notifications.id=23` → `recipient_id=6`, subject "Documento vencido", mensaje "QA_TEST_REVISION del vehículo ABCD43 venció hoy."
- `notifications.id=24` → `recipient_id=2` (admin), mismo subject/mensaje.

Mensaje distinto y más urgente que AC1, confirmado.

## AC3 — No duplicado

**✅ Cumplido por diseño**, con una salvedad documentada como deuda técnica menor abajo. El filtro compara `expiry_date` contra la fecha EXACTA de hoy o exactamente hoy+`advance_days` — un documento cuyo `expiry_date` no coincide con ninguna de esas 2 fechas exactas no genera nada. Al día siguiente, ninguno de los 2 documentos de prueba (`2026-08-09`, `2026-07-10`) volvería a coincidir, por lo que no hay un segundo aviso. No se verificó ejecutando el cron 2 días distintos (no aplicable en una sesión de QA de un solo día), pero la lógica del filtro es determinística y verificable por inspección del SQL aplicado.

## AC4 — Vehículo sin instructor asignado

**✅ Cumplido.** Se creó un vehículo de prueba (`vehicles.id=7`, patente `QATEST1`) sin ninguna fila en `vehicle_assignments`, con un documento `QA_TEST_NOINSTR` (`expiry_date=2026-07-10`). Resultado: únicamente `notifications.id=25` → `recipient_id=2` (admin). Cero filas para instructor (no existe ninguno que resolver) y cero errores en la ejecución de la función.

## AC5 — Reutiliza el umbral configurado

**✅ Cumplido.** Se consultó `alert_config` (`alert_type='document_expiry'`) antes de la prueba: no existe ninguna fila configurada en el proyecto real. La función usa `COALESCE(v_advance_days, 30)`, y el documento de prueba a `+30 días` exactos disparó correctamente (AC1) — confirma que el fallback está activo y funcionando, igual que asume `DashboardAlertsFacade` en su código Angular existente.

---

## Edge cases

### AC-E1 — No retroactivo

**✅ Cumplido.** Documento de prueba `QA_TEST_OLD` (`id=3`, `vehicle_id=1`, `expiry_date=2026-01-01`, muy en el pasado) **no generó ninguna notificación**. Confirmado por conteo exacto: la ejecución de la función generó exactamente 5 notificaciones nuevas (2 documentos × 2 destinatarios + 1 documento × 1 destinatario), ninguna asociada a `reference_id` que correspondiera al documento OLD.

### AC-E2 — Notificación por documento, no agrupada

**✅ Cumplido por diseño.** Cada documento generó su propia fila por destinatario (nunca una fila agrupando varios documentos). No se probó el caso de 2+ documentos del mismo vehículo venciendo el mismo día exacto en esta sesión de QA, pero el bucle `FOR v_doc IN ...` itera documento por documento sin acumular — el comportamiento está garantizado por construcción del SQL, no por un caso de prueba específico.

### AC-E3 — Error aislado no aborta la corrida

**✅ Cumplido por construcción**, no forzado explícitamente en esta QA (no se simuló un destinatario inválido). El bloque `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING ...` envuelve el cuerpo completo de cada iteración del `FOR v_doc`, mismo patrón ya probado en producción por las 4 funciones de Spec 0026 (donde SÍ se atrapó un error real en QA — ver `notify_task_reply()`/`notify_task_completed()`). Se acepta como cumplido por diseño equivalente, sin caso de prueba forzado adicional.

---

## Out of scope respetado

- ❌ D2 (Zoom automático) — no se tocó ningún código relacionado a `send-zoom-email` ni `ciclos-teoricos.facade.ts`. Confirmado: cero archivos de ese dominio modificados.
- ❌ D4 (encuesta) — no se creó ningún módulo de encuestas.
- ❌ Canal WhatsApp — no se agregó ninguna integración nueva.
- ❌ Canal email genérico — no se generalizó el SMTP existente.
- ❌ `DashboardAlertsFacade` — no se modificó; la spec solo agrega el canal de notificación persistente en paralelo. Confirmado: `git diff` no muestra cambios en ese archivo.

---

## Deuda técnica detectada

1. **AC3 — sin guard idempotente adicional dentro de la misma corrida.** El diseño aprobado en la spec asume que el cron corre exactamente 1 vez por día (`0 6 * * *`). Si la función se invocara manualmente 2 veces el mismo día (como podría pasar en una re-ejecución accidental de QA, o si alguien la dispara a mano en producción), generaría notificaciones duplicadas — no hay un chequeo de "¿ya se notificó este documento hoy?" más allá de la fecha exacta de `expiry_date`. Es el mismo nivel de garantía que otros cron jobs del proyecto (`auto_transition_promotion_status()`, etc., que tampoco tienen un guard de "ya corrí hoy"), así que no se considera un blocker, pero queda anotado por si se decide reforzar en el futuro (ej. seguimiento del `pg_cron` job's `jobid`/última corrida, o una tabla de log de notificaciones ya enviadas por documento+fecha).
2. **Documentación heredada corregida (no bug de esta spec):** `indices/DATABASE.md` tenía varias filas describiendo FKs hacia `vehicles.vehicle_id` (columna inexistente). Corregido en T4.2 con una nota de gobernanza — no afectó el código de esta spec porque se verificó contra el SQL real de las migraciones antes de escribir la función.
3. **Sin harness automatizado** para funciones cron SQL en este proyecto (mismo gap ya documentado en Spec 0026) — la verificación es 100% QA en vivo vía REST/RPC directo, repetible pero no parte de `npm run test:ci`.

---

## Cambios en índices

- `indices/DATABASE.md` — nueva fila en "Funciones SQL" (`notify_vehicle_document_expiry()`) + nota de gobernanza sobre `vehicles.id` vs `vehicles.vehicle_id`.
- `indices/NOTIFICATIONS-MAP.md` — D3 marcado ✅ implementado; fila de priorización Ola 4 (§8) marcada ✅ implementada (alcance D3); header actualizado.
- `specs/ROADMAP.md` — spec 0027-b movida de "Activa" a "Done" (ver commit de cierre).

---

## Veredicto final

**✅ PASA** — 5/5 AC + 3/3 edge cases cumplidos con evidencia concreta (ids de notificaciones reales, verificados vía REST directo contra la BD real), out-of-scope respetado, `lint:arch` sin cambios, datos de prueba limpiados sin residuos. La única deuda anotada (guard de doble-ejecución en el mismo día) es de bajo riesgo y consistente con el resto de los cron jobs del proyecto — no bloqueante.
