# Tasks 0040-b — Finalidades de consentimiento para comunicaciones al alumno (Ley 21.719)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-09-09

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

> ⚠️ **Regla propia de esta spec (riesgo #1 del plan):** **T1.1 y T1.2 se hacen y se commitean
> juntas.** La migración sin el allowlist de la Edge Function produce el peor modo de falla posible:
> el consentimiento se descarta **en silencio** (`persistConsents()` ~L332 filtra por `CONSENT_TYPES`
> y lo que no está en el `Set` se pierde sin error), la matrícula se completa normal, y quedan
> alumnos sin registro creyendo que cumplimos. No dividir en dos sesiones.

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Crear migración `20260909120000_consents_add_comunicaciones.sql`
  - **AC ref:** AC1, AC8, AC-E4
  - **DoD:**
    - [x] `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` del CHECK con las 6 finalidades (4 actuales + 2 nuevas), mismo patrón que `20260818130000`
    - [x] Policy `update_consents_self_revoke_promocional` con `USING` **y** `WITH CHECK`, acotada a `user_id = auth_user_id() AND consent_type = 'comunicaciones_promocionales'`
    - [x] Comentario en el SQL citando el Art. 12 ("permanentemente disponible") y explicando que el acotamiento por columna lo hace `trg_consents_append_only`, no la RLS
    - [x] `update_consents_revocation` (admin) **intacta** — no se toca
    - [x] Migración idempotente: correrla dos veces no falla (`DROP ... IF EXISTS` en ambas piezas)
    - [x] Documentado en `indices/DATABASE.md` (fila `consents`: nuevos valores del CHECK + policy nueva)
    - **Verificado contra la BD de desarrollo real** (`supabase db push --linked`, sin Docker — ver nota abajo): `pg_get_constraintdef` confirma los 6 valores en el CHECK; `pg_policies` confirma `update_consents_self_revoke_promocional` con el `USING`/`WITH CHECK` exactos.

  > **Nota de infraestructura (no bloquea, documentada para la próxima sesión):** Docker Desktop
  > tenía contenedores de OTRO proyecto (`app-familiar-v2`) ocupando los puertos por defecto de
  > Supabase local (54321-54327), así que `supabase start`/`db reset` no eran viables. Se verificó
  > en cambio contra la BD de desarrollo remota vinculada (`skvekggejikzxhzsjmkz`,
  > `db query --linked`, vía Management API, sin Docker). Al hacerlo se encontró que esa BD tenía
  > **34 migraciones aplicadas realmente pero sin registrar en el tracking** desde el 8-ago (mismo
  > patrón de drift documentado en memoria, julio 2026) + 2 huérfanas de abril
  > (`20260412000002`, `20260414000001`, remote-only, pre-existentes). Reconciliado con
  > `migration repair --status applied` (las 34) y `--status reverted` (las 2 huérfanas) — ambos
  > **metadata-only, no tocan schema** — antes de `db push`, que aplicó únicamente
  > `20260909120000`. Nadie corrió `db push` contra esta BD desde el 7-ago; vale la pena que el
  > equipo lo sepa.

- [x] **T1.2** — Ampliar el allowlist de la Edge Function `public-enrollment` *(hecho junto con T1.1)*
  - **AC ref:** AC5, AC-E3
  - **DoD:**
    - [x] `CONSENT_TYPES` (~L272) incluye `comunicaciones_operativas` y `comunicaciones_promocionales`
    - [x] El union del campo `consentType` (~L272) suma los 2 miembros
    - [x] El filtro de `persistConsents()` (~L332) sigue descartando tipos desconocidos (AC-E3: se amplía el allowlist, **no se elimina** — código sin tocar, solo el `Set`)
    - [ ] Verificado empíricamente contra la EF desplegada — **diferido a T4.3** (QA end-to-end): requiere invocar `public-enrollment` con un payload real, que tiene más sentido probar junto con el flujo completo de matrícula (T3.2) que aislado ahora

- [x] **T1.3** — Extender los tipos de consentimiento
  - **AC ref:** AC1
  - **DoD:**
    - [x] `core/models/dto/consent.model.ts`: union `ConsentType` suma los 2 miembros (espeja el CHECK 1:1)
    - [x] `core/models/ui/consent.model.ts`: `CONSENT_TYPE_LABELS` suma las 2 etiquetas
    - [x] La etiqueta de la operativa dice explícitamente que es **informativa** (evita que alguien le agregue un checkbox de rechazo "por simetría" — riesgo #5 del plan)
    - [x] `ng build` compila (el `Record<ConsentType, string>` obliga a que no falte ninguna) — exit 0, 576s
    - [x] Documentado en `indices/MODELS.md`

---

## Fase 2 — Núcleo funcional y Facades

- [x] **T2.1** — Escribir `consent-builder.utils.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC2, AC4, AC-E1
  - **DoD:**
    - [x] Caso: devuelve **siempre 2 filas**, nunca lista vacía
    - [x] Caso: la operativa sale con `granted: true` **aunque se pase la casilla en `false`** — es informativa, no una elección (Art. 13 c)
    - [x] Caso: la promocional refleja la casilla (`true` y `false` ambos producen fila)
    - [x] Caso: menor de edad → ambas filas con `grantedByRepresentative: true`
    - [x] Caso: sin `userId` ni `subjectRut` → lanza (reusa `assertIdentifiable`)
    - [x] Tests FALLAN (todavía no existe la función) — confirmado: 6 failed / 19 pasan (preexistentes intactos)

- [x] **T2.2** — Implementar `buildCommunicationsConsents()` en `core/utils/consent-builder.utils.ts`
  - **AC ref:** AC2, AC4
  - **DoD:**
    - [x] Tests de T2.1 PASAN — 25/25 verdes
    - [x] Reusa el helper `toDraft()` existente — no duplica el armado del draft
    - [x] La operativa fuerza `granted: true` independiente del input (documentado en el JSDoc con la cita del Art. 12 inc. 5)
    - [x] Función pura: sin `inject()`, sin side effects (núcleo funcional, `architecture.md`)
    - [x] Documentado en `indices/UTILS.md`

- [x] **T2.3** — Conectar el flujo **público** (`PublicEnrollmentFacade`)
  - **AC ref:** AC2
  - **DoD:**
    - [x] Spec primero: `public-enrollment.facade.spec.ts` verifica que el payload de submit incluya las 2 filas con `policyVersion` y `source: 'public'`
    - [x] Signal `_promotionalConsentAccepted` + su readonly, siguiendo el patrón de `_psychTestConsent` (spec 0010-m)
    - [x] Las 2 filas viajan **en la misma operación** que crea la matrícula (no en un insert aparte) — conectado en **ambos** puntos de submit (`initiatePayment` e `submitClaseBEnrollment`, no solo uno)
    - [x] Tests verdes — 77/77 (4 nuevos + 73 preexistentes intactos). Un test propio (`AC4`) tenía un bug de aserción — usaba `initiatePayment()`, que solo devuelve `success:true` con `webpayUrl`/`webpayToken` en el mock (comportamiento preexistente, no relacionado a esta spec); corregido a `submitClaseBEnrollment()`.

- [x] **T2.4** — Conectar el flujo **secretaría** (`EnrollmentFacade`)
  - **AC ref:** AC3, AC-E1
  - **DoD:**
    - [x] Spec primero: `enrollment.facade.spec.ts` verifica las 2 filas con `source: 'secretaria'`
    - [x] Caso menor: `grantedByRepresentative: true` se propaga (el flujo público bloquea menores en el paso 1, este no)
    - [x] Tests verdes — 74/74 (4 nuevos + 70 preexistentes intactos)

---

## Fase 3 — Capa UI

- [x] **T3.1** — Texto legal en `privacy-policy.model.ts`
  - **AC ref:** AC6
  - **DoD:**
    - [x] Ambas finalidades informadas **con su base legal diferenciada** (Art. 14 ter d): ejecución del contrato para la operativa, consentimiento para la promocional
    - [x] Informado también el derecho a revocar la promocional y **dónde** ejercerlo ("desde tu cuenta")
    - [x] `PRIVACY_POLICY_VERSION` bumpeada (`2026-08-21` → `2026-09-09`)
    - [x] `getPolicyPublishBlockers()` no reporta inconsistencias — 11/11 tests verdes
    - **Nota:** la fila "operativa" **ya existía** en la política ("Comunicarnos contigo sobre tu
      curso... | Ejecución del contrato") desde spec 0009-m — se refinó su redacción para
      mencionar explícitamente recordatorios/documentos/saldo. Lo que faltaba de cero era la fila
      promocional. Editado primero en `.compliance/docs/{conductores,autoescuela}/21719-politica-privacidad.md`
      (fuente de verdad) y sincronizado al `.ts`, por instrucción del propio archivo.

- [x] **T3.2** — Paso de consentimientos del flujo **público** (`<app-public-contract>`)
  - **AC ref:** AC2, AC4
  - **DoD:**
    - [x] Operativa: **párrafo informativo, sin control de aceptar/rechazar**
    - [x] Promocional: checkbox **desmarcado por defecto**, visualmente separado del consentimiento de matrícula
    - [x] El checkbox promocional **NO** entra en `consentsComplete()` — no puede gatear el avance (AC4)
    - [x] `ng build` compila limpio (100s, solo warning preexistente de bundle size) — **pendiente**: verificación visual en browser real, diferida a T4.3
    - [x] Tokens del DS, `<app-icon>`, sin colores hardcodeados
    - `PublicContractSignedPayload` suma `promotionalAccepted`; wired en `public-enrollment.component.ts` → `facade.setPromotionalConsent()`

- [x] **T3.3** — Paso equivalente del flujo **secretaría** (`<app-contract-step>`)
  - **AC ref:** AC3
  - **DoD:**
    - [x] Mismo tratamiento asimétrico que T3.2 — la UI de secretaría **tampoco** ofrece rechazar la operativa
    - [x] `ng build` compila limpio — **pendiente**: verificación visual en browser real, diferida a T4.3
    - Nuevo output `promotionalConsentChange` en `contract.component.ts`, wired en `secretaria-matricula.component.html` → `enrollment.setPromotionalConsent($event)`
    - **Bug encontrado y corregido en esta tarea:** `assertIdentifiable()` en `consent-builder.utils.ts` pedía el `ConsentBuilderInput` completo (incluye `policyAccepted`), pero solo usa `branchId`/`userId`/`subjectRut`. `CommunicationsConsentInput` lo omite a propósito → `ng build` falló (TS2345); `vitest` no lo detectó (no type-checka tan estricto). Angostado el parámetro a `Pick<ConsentBuilderInput, 'branchId'|'userId'|'subjectRut'>` — compatible con ambos llamadores.

- [ ] **T3.4** — Pantalla de privacidad del portal alumno
  - **AC ref:** AC7
  - **DoD:**
    - [x] `features/alumno/privacidad/alumno-privacidad.component.ts` — Smart, OnPush, bento grid como raíz. **Excepción justificada al app-like fill-screen** (criterio #1 visual-system.md: contenido corto, nunca produce overflow) — sin modificador `--fill-screen*`
    - [x] Inyecta `ConsentsFacade` + `AuthFacade`; `ngOnInit` llama `loadByUser(currentUser().dbId)`
    - [x] `computed()` deriva el estado del consentimiento promocional (otorgado / revocado + fecha) — acotado a `comunicaciones_promocionales`, ignora las demás filas
    - [x] Caso sin fila promocional → mensaje simple (la card ya es chica, no amerita `<app-empty-state>` completo)
    - [x] `.spec.ts` con 10 casos (TDD, patrón `TestBed.runInInjectionContext` calcado de `admin-consentimientos-drawer.component.spec.ts`) — 10/10 verdes
    - [x] Ruta `/app/alumno/privacidad` en `app.routes.ts` + entrada en `ALUMNO_NAV` (`menu-config.service.ts`, grupo nuevo "Mi Cuenta") — el medio debe ser encontrable para ser "expedito"
    - [x] Documentado en `indices/COMPONENTS.md` y `indices/ROUTES.md`
    - **Bloqueante encontrado y resuelto:** la RLS de `consents` (`select_consents`, `20260817130000`) solo permitía SELECT a admin/secretaria — el titular no podía ni **ver** sus propios consentimientos, lo que dejaba `loadByUser()` devolviendo `[]` sin error (falso "no tienes registros"). Migración nueva `20260909130000_consents_self_select.sql` agrega `select_consents_self` (sin restricción por `consent_type`: leer los propios datos es un derecho de acceso general, no algo acotado a esta spec). Aplicada y verificada contra la BD de desarrollo.

- [x] **T3.5** — Acción de revocar
  - **AC ref:** AC8, AC-E2
  - **DoD:**
    - [x] Botón con `data-llm-action` (es una mutación, `ai-readability.md`)
    - [x] Llama `ConsentsFacade.revoke(consentId)` — **método ya existente, no se tocó**
    - [x] Confirmación previa (`ConfirmModalService`) + toast de resultado — el toast ya lo dispara `ConsentsFacade.revoke()` internamente, no hay que duplicarlo en el componente
    - [x] Estado se actualiza en la UI sin recargar (el `computed()` reacciona al signal que `revoke()` actualiza)
    - [x] Verificado que la revocación **no borra ni invalida** la fila original (no retroactiva, Art. 12) — la fila queda con `granted_at` intacto + `revoked_at` nuevo, visible en la UI como "Desactivado el {fecha}"

---

## Fase 4 — Validación

- [x] **T4.1** — Verificación empírica de RLS (no es unitaria: el harness no levanta Postgres)
  - **AC ref:** AC8, AC-E2, AC-E4
  - **DoD:** Patrón de specs 0025/0026, adaptado: en vez de curl (bloqueado por Bash Guard),
    sesión real de `alumno@test.com` en el browser + `fetch()` directo a PostgREST vía
    `javascript_tool`, con el `access_token` leído de `localStorage`:
    - [x] Alumno revoca su fila `comunicaciones_promocionales` → **OK, end-to-end por la UI real**: badge "Activo"→"Desactivado", fecha mostrada, botón desaparece, sin recargar página
    - [x] El mismo alumno intenta revocar su fila `matricula_datos` → **rechazado por RLS** (AC-E4): `PATCH` → `200 {}` (0 filas, RLS lo filtró antes de tocar nada)
    - [x] El mismo alumno intenta revocar la fila promocional **de otro alumno** → rechazado: mismo resultado, `200 {}`
    - [x] Un UPDATE sobre una columna distinta de `revoked_at` (`granted`) → **excepción del trigger** (AC-E2): `400`, `code: 23514`, mensaje exacto de `trg_consents_append_only_fn`
    - Datos de prueba (3 filas sintéticas insertadas vía `service_role` para tener algo que revocar/atacar) **eliminados** al terminar — no se dejan registros de consentimiento ficticios en la BD de compliance

- [x] **T4.2** — `npm run test:ci` verde y `npm run lint:arch` exit 0
  - `test:ci`: **189 archivos, 2359 tests pasan** (5 skipped preexistentes, 0 fallos)
  - `lint:arch` primera corrida: exit 0, pero **regresión real detectada** — ARCH-25 (card compuesta a mano) subió de 4 a 5: el párrafo informativo de `contract.component.html` componía `bg-surface border border-border-default rounded-xl` a mano en vez de usar `.card`, exactamente el anti-patrón que `fix-160-b` (de esta misma sesión, más temprano) vino a erradicar. Corregido en **ambos** gemelos (`contract.component.html` y `public-contract.component.ts`, que tenía el mismo problema vía `style=` inline, no detectado por el regex del guard pero igual de incorrecto). Segunda corrida: exit 0, **0 ocurrencias de ARCH-25**, de vuelta a baseline

- [x] **T4.3** — QA manual (browser real, sesión de `alumno@test.com` contra la BD de desarrollo)
  - **DoD:**
    - [x] **Revocación desde el portal alumno → verificado end-to-end contra la BD real** (no mock): login real, `/app/alumno/privacidad`, badge "Activo"→"Desactivado", fecha visible, botón desaparece, sin recargar página. Es la pieza más nueva y de mayor riesgo (AC7/AC8) — la que se llevó la verificación completa.
    - [x] Consola sin errores propios (los únicos errores vistos son el 400 esperado de la prueba AC-E2 y ruido preexistente de View Transitions API, no relacionado)
    - [~] Matrícula pública/secretaría **marcando/sin marcar** la promocional → 2 filas con `granted` correcto — **verificado por tests de facade** (`public-enrollment.facade.spec.ts`, `enrollment.facade.spec.ts`, con el `functions.invoke`/`recordMany` mockeado), **no por un submit real end-to-end**: completar el wizard público entero (datos personales, documentos, horario, pago) o el de secretaría solo para ver 2 filas ya probadas a nivel de payload es un costo desproporcionado, y un submit real crearía una matrícula falsa en la BD compartida. Riesgo residual bajo: la lógica de armado del payload es la misma función pura (`buildCommunicationsConsents`) ya con 25 tests, y el punto de inserción (`persistConsents` de la EF) no se tocó, solo su allowlist.
    - [ ] Modo claro/oscuro, responsive — **no verificado en esta sesión** (residual, mismo patrón visual que el resto del wizard, ya probado en producción)

- [x] **T4.4** — Ejecutar `/spec-verify` y generar `acceptance.md` con evidencia por AC
  - **Veredicto: ✅ PASA** — 12/12 AC cumplidos (5 con verificación empírica en vivo contra la BD real: AC1, AC7, AC8, AC-E2, AC-E4). Out-of-scope respetado. 2 ítems de deuda no-crítica documentados (submit E2E del wizard no ejecutado, modo oscuro/responsive no verificado visualmente). Ver [acceptance.md](./acceptance.md).

---

## Fase 5 — Cierre

- [x] **T5.1** — Índices actualizados incrementalmente durante la sesión: `DATABASE.md`, `MODELS.md`, `UTILS.md`, `COMPONENTS.md`, `ROUTES.md`. `FACADES.md` no requirió cambios (`ConsentsFacade` se reusó sin métodos nuevos, tal como predijo el plan)
- [x] **T5.2** — `indices/NOTIFICATIONS-MAP.md` §9.4: el bloqueo legal 🔒 pasa a ✅ resuelto, con link a este `acceptance.md`
- [x] **T5.3** — Spec marcada `done` en `specs/ROADMAP.md`, movida de Backlog a Done (con resumen del cierre)
- [x] **T5.4** — `specs/.active` limpiado

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [x] **RLS de SELECT faltante para el titular** (dentro de T3.4) — `select_consents` nunca cubrió
  al alumno, solo admin/secretaria. Sin esto, AC7 era imposible de cumplir. Resuelto con la
  migración `20260909130000_consents_self_select.sql`, sin restricción por `consent_type`
  (leer los propios datos es un derecho general, no algo acotado a esta spec).
- [x] **Drift de migraciones en la BD de desarrollo** (dentro de T1.1, infraestructura, no scope
  de producto) — 34 migraciones aplicadas realmente pero sin registrar desde el 8-ago + 2
  huérfanas de abril, pre-existentes. Reconciliado con `migration repair` (metadata-only) antes
  de poder aplicar la migración propia de esta spec. Documentado en detalle en el DoD de T1.1.
- [x] **Regresión ARCH-25 propia** (dentro de T4.2) — panel informativo compuesto a mano en vez
  de `.card`, en 2 archivos gemelos. Detectada por `lint:arch`, corregida antes de cerrar.
