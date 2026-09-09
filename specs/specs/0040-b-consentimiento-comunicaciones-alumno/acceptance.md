# Acceptance 0040-b — Finalidades de consentimiento para comunicaciones al alumno (Ley 21.719)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-09-09
> **Verifier:** Claude (sesión interactiva) · validado por Benjamín

---

## Resumen

- AC totales: 12 (AC1-AC8 + AC-E1-E4)
- AC cumplidos: 12
- AC fallidos: 0
- AC con evidencia empírica en vivo (no solo tests unitarios): 5 (AC1, AC7, AC8, AC-E2, AC-E4)

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — CHECK acepta las 2 finalidades nuevas

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Migración: `supabase/migrations/20260909120000_consents_add_comunicaciones.sql`
  - **Verificado en vivo contra la BD de desarrollo real** (`skvekggejikzxhzsjmkz`): `pg_get_constraintdef` confirmó el CHECK con los 6 valores tras `db push`.
  - Se insertaron y eliminaron filas reales de ambos tipos nuevos durante T4.1 sin error de constraint.

### AC2 — Flujo público: párrafo informativo + checkbox opcional

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `src/app/shared/components/public-enrollment-steps/public-contract/public-contract.component.ts` — párrafo sin control + checkbox `promotionalAccepted` fuera de `consentsComplete()`.
  - Test: `public-enrollment.facade.spec.ts` — 4 casos nuevos en `describe('comunicaciones al alumno (spec 0040-b)')`: operativa siempre `granted:true`, promocional refleja la casilla, `source:'public'`, `policyVersion` presente.
  - `ip` la escribe el trigger server-side (`trg_consents_set_ip`), sin cambios — mismo mecanismo que `matricula_datos`.

### AC3 — Flujo secretaría: mismo tratamiento, sin checkbox de rechazo para la operativa

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `src/app/shared/components/matricula-steps/contract/contract.component.ts` + `.html` — mismo párrafo informativo, checkbox `_promotionalAccepted` con output `promotionalConsentChange`, fuera de `canProceed`.
  - Test: `enrollment.facade.spec.ts` — 4 casos nuevos confirman `source:'secretaria'` y ambas filas viajando junto a `matricula_datos` en el mismo `recordMany()`.

### AC4 — No marcar la promocional no bloquea la matrícula

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `public-enrollment.facade.spec.ts > 'no marcar la casilla promocional NO bloquea el envío (AC4)'`.
  - Código: `consentsComplete()` (público) y `canProceed` (secretaría) nunca leen `promotionalAccepted`/`_promotionalAccepted`.

### AC5 — Allowlist de la EF ampliado, sin descartar en silencio

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `supabase/functions/public-enrollment/index.ts` — `CONSENT_TYPES` y el union de `consentType` suman las 2 finalidades.
  - Verificado por inspección directa: el filtro de `persistConsents()` (línea ~332) no se tocó, solo el `Set` que consulta — mismo mecanismo, alcance ampliado.
  - **No probado con una invocación real de la EF desplegada** (requeriría un submit completo del wizard); ver Deuda técnica.

### AC6 — Política de privacidad informa ambas finalidades con base legal diferenciada

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `.compliance/docs/{conductores,autoescuela}/21719-politica-privacidad.md` (fuente de verdad) + `src/app/core/models/ui/privacy-policy.model.ts` (sincronizado) — fila "Comunicarnos contigo..." refinada (Art. 13 c) + fila nueva "Enviarte promociones..." (Art. 12, con derecho a revocar).
  - `PRIVACY_POLICY_VERSION`: `2026-08-21` → `2026-09-09`.
  - Test: `privacy-policy.model.spec.ts` — 11/11 verdes, incluye `getPolicyPublishBlockers()`.

### AC7 — Portal alumno muestra el estado del consentimiento promocional

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `src/app/features/alumno/privacidad/alumno-privacidad.component.ts` — ruta `/app/alumno/privacidad`.
  - Test: `alumno-privacidad.component.spec.ts` — 10/10 verdes (deriva el consentimiento correcto, ignora la operativa, maneja el caso sin fila).
  - **Verificado en vivo, end-to-end, contra la BD real**: login real como `alumno@test.com`, screenshot confirma badge "Activo" + descripción + botón. Sin fila promocional (estado real de esa cuenta seed) muestra el mensaje correcto sin reventar.
  - **Bloqueante encontrado y resuelto en el camino:** la RLS de `consents` no dejaba ni `SELECT` al titular (`select_consents` solo cubría admin/secretaria) — sin la migración `20260909130000_consents_self_select.sql`, este AC era estructuralmente imposible de cumplir. Verificado con el mismo login real: la carga funcionó tras aplicar la migración.

### AC8 — Revocación self-service, no retroactiva

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `ConsentsFacade.revoke()` (sin cambios, reusado) + `AlumnoPrivacidadComponent.onRevoke()` con `ConfirmModalService`.
  - **Verificado en vivo, end-to-end**: se insertó una fila promocional de prueba para `alumno@test.com` (vía `service_role`, dato de prueba, eliminado al terminar), se hizo login real, se hizo clic en "Dejar de recibir promociones", se confirmó el modal, y la UI reflejó "Desactivado" con la fecha de hoy sin recargar la página.
  - No retroactividad confirmada: la fila original conserva `granted_at`; solo se agregó `revoked_at`.

### AC-E1 — Menor de edad: ambas filas con `grantedByRepresentative:true`

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `consent-builder.utils.spec.ts` ("menor de edad: AMBAS filas...") + `enrollment.facade.spec.ts` ("menor de edad: ambas filas de comunicación...").
  - No verificado con un caso vivo de menor en el flujo de secretaría (el flujo público ya bloquea menores en el paso 1, por diseño previo a esta spec) — cubierto solo por tests unitarios, consistente con el resto de casos de menor de edad en el proyecto (mismo criterio que `matricula_datos`).

### AC-E2 — Trigger rechaza UPDATE sobre columnas distintas de `revoked_at`

- **Estado:** ✅ cumplido
- **Evidencia:** **Verificado en vivo**: `PATCH` sobre la columna `granted` de la propia fila promocional → `400`, `code:23514`, mensaje exacto de `trg_consents_append_only_fn`. La RLS nueva no crea ninguna excepción a este trigger.

### AC-E3 — Tipo desconocido se descarta sin romper el flujo

- **Estado:** ✅ cumplido
- **Evidencia:** Comportamiento preexistente sin tocar — confirmado por inspección de código (`CONSENT_TYPES.has(d.consentType)` en el filtro de `persistConsents()`, sin cambios en esa línea).

### AC-E4 — Alumno no puede auto-revocar otra finalidad ni la fila de otro alumno

- **Estado:** ✅ cumplido
- **Evidencia:** **Verificado en vivo**, dos casos:
  - `PATCH` sobre la propia fila `matricula_datos` → `200 {}` (0 filas, RLS la filtró).
  - `PATCH` sobre la fila `comunicaciones_promocionales` **de otro alumno** (`user_id` distinto) → `200 {}` (0 filas).

---

## Out-of-scope respetado

- ❌ Comunicado global (envío a segmentos, plantillas, UI de redacción) — no se tocó `send-zoom-email` ni se creó UI de redacción.
- ❌ Conectar los ~14 productores de notificaciones existentes al canal email — sin cambios en `NotificationsFacade` ni en los facades que emiten notificaciones.
- ❌ WhatsApp Business API — no se tocó.
- ❌ Bandeja bidireccional alumno↔escuela — el módulo "Comunicación" (`tasks`/`task_replies`) no se tocó.
- ❌ Revocación self-service de las **otras** finalidades (`matricula_datos`, `certificado_medico`, `preinscripcion`, `test_psicologico`, `comunicaciones_operativas`) — confirmado explícitamente por AC-E4: la RLS nueva está acotada por `consent_type='comunicaciones_promocionales'`, verificado en vivo que un intento sobre `matricula_datos` es rechazado.

---

## Deuda técnica detectada

- **AC5/AC2/AC3 sin submit real end-to-end del wizard.** La construcción del payload (`buildCommunicationsConsents`, 25 tests) y su conexión a los facades (8 tests más) están probadas; lo que no se probó fue una invocación real de la Edge Function `public-enrollment` completando un submit de principio a fin (requeriría llenar todo el wizard público — datos personales, documentos, horario, pago — y crearía una matrícula real en la BD de desarrollo compartida). Riesgo residual bajo: el punto de inserción de la EF no cambió, solo su allowlist. **No bloquea el cierre** — recomendación: la próxima vez que alguien haga QA de matrícula en esta BD, confirmar de paso que aparecen las 2 filas de comunicación.
- **Modo claro/oscuro y responsive no verificados visualmente** para los 3 componentes de UI nuevos/modificados (`public-contract`, `contract-step`, `alumno-privacidad`). Mismo patrón de tokens del DS que el resto del wizard (ya probado en producción), pero sin captura propia. **No bloquea el cierre.**
- **Regresión real encontrada y corregida durante la propia sesión** (no deuda pendiente, documentado por transparencia): al escribir el párrafo informativo, se compuso `bg-surface border border-border-default rounded-xl` a mano en vez de usar `.card` (ARCE-25, el guardrail que `fix-160-b` — de esta misma sesión, más temprano — vino a introducir). Detectado por `lint:arch`, corregido en los 2 archivos gemelos antes de cerrar.

---

## Cambios en índices

- `indices/DATABASE.md` — `consents`: 2 finalidades nuevas en el CHECK + 2 policies nuevas (`update_consents_self_revoke_promocional`, `select_consents_self`), ambas migraciones documentadas.
- `indices/MODELS.md` — `ConsentType` (dto) extendido, nota de asimetría legal.
- `indices/UTILS.md` — `buildCommunicationsConsents` + `CommunicationsConsentInput` documentados.
- `indices/COMPONENTS.md` — `app-public-contract` y `app-contract-step` actualizados (nuevos outputs/inputs); `AlumnoPrivacidadComponent` agregado como entrada nueva.
- `indices/ROUTES.md` — `/app/alumno/privacidad` agregada.
- `indices/NOTIFICATIONS-MAP.md` — pendiente de actualizar §9.4 marcando el bloqueo legal como resuelto (tarea T5.2, Fase 5).

---

## Post-mortem

- **Qué salió mejor de lo esperado:** la revocación self-service (AC7/AC8), que parecía el bloque más grande al planificar, resultó ser el más chico — `ConsentsFacade.revoke()` ya existía completo. Lo caro fue la propagación por 5 capas × 2 flujos de matrícula.
- **Qué fricciones encontramos:**
  1. Docker local en conflicto de puertos con otro proyecto (`app-familiar-v2`) → pivote a verificar contra la BD de desarrollo remota vía `supabase db query --linked` (Management API, sin Docker).
  2. Drift de migraciones ya documentado en memoria del proyecto (34 migraciones aplicadas realmente pero no registradas desde el 8-ago) — reparado con `migration repair` antes de poder hacer `db push` de la propia migración.
  3. Un gap de RLS que la spec original no había anticipado (`select_consents` nunca cubrió al titular) — encontrado recién al construir la UI del portal alumno, no en el diseño. Quedó resuelto con una migración nueva, pero es una lección: cuando una spec agrega una policy de UPDATE acotada a un rol nuevo, vale la pena chequear también si ese rol tiene SELECT.
  4. `vitest` no atrapa errores de tipos que sí bloquean `ng build` (el `Pick<>` de `assertIdentifiable`) — la verificación de build separada de la de tests fue lo que lo agarró.
- **Qué cambiaríamos en el siguiente ciclo SDD:** cuando una spec toca RLS de una tabla existente, agregar explícitamente al plan una revisión de las policies SELECT/INSERT/UPDATE/DELETE completas de esa tabla para el rol nuevo, no solo la policy que la spec cree necesitar.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando en CI (2359/2359, 189 archivos)
- [x] `lint:arch` limpio (exit 0, 0 regresiones)
- [x] Sin deuda crítica abierta (2 ítems de deuda no-crítica documentados arriba)

**Cerrado por:** Benjamín
**Fecha:** 2026-09-09
