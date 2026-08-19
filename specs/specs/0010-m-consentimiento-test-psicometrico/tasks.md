# Tasks 0010-m — Consentimiento del test psicométrico EPQ

> **Plan:** [plan.md](./plan.md) · **Spec:** [spec.md](./spec.md)
> **Created:** 2026-08-18

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Migración: agregar `test_psicologico` al CHECK de `consents.consent_type`
  - **AC ref:** AC4
  - **DoD:**
    - [x] Archivo `supabase/migrations/20260818130000_consents_add_test_psicologico.sql`, idempotente
    - [x] `DROP CONSTRAINT` + `ADD CONSTRAINT` con los 4 valores (`matricula_datos`,
          `certificado_medico`, `preinscripcion`, `test_psicologico`)
    - [x] Aplicada en Supabase local (`npx supabase db reset`) sin error — CHECK verificado con
          `pg_get_constraintdef()`
    - [x] Documentada en `indices/DATABASE.md` (fila `consents`)

- [x] **T1.2** — Extender `ConsentType` y `CONSENT_TYPE_LABELS`
  - **AC ref:** AC4, AC5
  - **DoD:**
    - [x] `src/app/core/models/dto/consent.model.ts` — `ConsentType` suma `'test_psicologico'`
    - [x] `src/app/core/models/ui/consent.model.ts` — `CONSENT_TYPE_LABELS['test_psicologico'] =
          'Test psicométrico EPQ (dato de salud psíquica)'`
    - [x] `npx tsc --noEmit` sin errores de tipos en los consumidores existentes
    - [x] Documentado en `indices/MODELS.md`

---

## Fase 2 — Consent builder (TDD)

- [x] **T2.1** — Test primero: `buildPsychTestConsent()` en `consent-builder.utils.spec.ts`
  - **AC ref:** AC2, AC3, AC-E1
  - **DoD:**
    - [x] Caso: casilla marcada → draft `{ consentType: 'test_psicologico', granted: true, source:
          'public' }`
    - [x] Caso: casilla no marcada → draft con `granted: false` (la negativa se registra igual,
          nunca ausencia de draft)
    - [x] Caso: sin `userId` ni `subjectRut` → lanza (mismo `assertIdentifiable` que las demás)
    - [x] Tests escritos ANTES de la implementación (rojo primero)

- [x] **T2.2** — Implementar `buildPsychTestConsent()` en `consent-builder.utils.ts`
  - **AC ref:** AC2, AC3
  - **DoD:**
    - [x] Mismo patrón que `buildMedicalCertificateConsent()` — reutiliza `toDraft()`/
          `assertIdentifiable()` existentes, sin duplicar lógica
    - [x] `source` fijo en `'public'` (comentario explicando por qué difiere del certificado médico)
    - [x] Tests de T2.1 PASAN (17/17, `npm run test:ci`)
    - [x] Documentado en `indices/UTILS.md`

---

## Fase 3 — Facade (gate cliente)

- [x] **T3.1** — Test primero: gate del consentimiento en `public-enrollment.facade.spec.ts`
  - **AC ref:** AC3, AC-E1
  - **DoD:**
    - [x] Caso: `psychTestConsent()` en `false` + 81 respuestas ya en `_psychTestAnswers` →
          `submitPreInscription()` llama a la EF con `skipPsychTest: true`
    - [x] Caso: `psychTestConsent()` en `true` + 81 respuestas → manda `skipPsychTest: false` +
          las respuestas
    - [x] Caso: en ambos, `body.consents` incluye el draft `test_psicologico` con el `granted`
          correspondiente

- [x] **T3.2** — Implementar el signal y el gate en `public-enrollment.facade.ts`
  - **AC ref:** AC2, AC3
  - **DoD:**
    - [x] Signal privado `_psychTestConsent` (boolean, default `false`) + público
          `psychTestConsent` readonly + método `setPsychTestConsent(v: boolean)`
    - [x] `submitPreInscription()`: si `!this._psychTestConsent()`, fuerza `skipTest: true` sin
          importar el estado de `psychTestAnswers()`
    - [x] `submitPreInscription()` agrega el draft de `buildPsychConsent()` al array de
          `consents` del payload
    - [x] Tests de T3.1 PASAN (73/73, `npm run test:ci`)
    - [x] Reset del signal en los dos puntos donde ya se resetean `_psychTestAnswers`
          (`clearSubsequentStepData` + reset general)

---

## Fase 4 — Edge Function (gate servidor)

- [x] **T4.1** — `CONSENT_TYPES` + gate server-side en `handleSubmitPreInscription()`
  - **AC ref:** AC3, AC-E1
  - **DoD:**
    - [x] `CONSENT_TYPES` suma `'test_psicologico'`
    - [x] Helper `hasGrantedPsychConsent(consents)` — busca en `body.consents` un draft
          `consentType==='test_psicologico'` con `granted===true`
    - [x] `omitsPsychTest` se recalcula como `skipPsychTest === true || !hasGrantedPsychConsent(body.consents)`
          — **no confía en `skipPsychTest` solo**
    - [x] Con `omitsPsychTest` en `true`: `psych_test_answers: null`, `psych_test_status:
          'not_started'`, sin importar qué haya en `psychTestAnswers` del body
    - [x] `persistConsents()` sigue lanzando `CONSENT_PERSIST_FAILED` si el insert falla — sin
          cambios en ese contrato

- [x] **T4.2** — Test de integración (Supabase local)
  - **AC ref:** AC3
  - **DoD:**
    - [x] Invocación con `consents: []` (sin draft `test_psicologico`) y 81 respuestas en el body →
          la fila insertada en `professional_pre_registrations` tiene `psych_test_answers IS NULL`
          (verificado vía `docker exec ... psql`)
    - [x] Invocación con el draft `granted:true` + 81 respuestas → la fila queda con las 81
          respuestas y `psych_test_status='completed'`
    - [x] En ambos casos queda un registro en `consents` con `consent_type='test_psicologico'`
          reflejando el `granted` real (AC4) — confirmado `granted=false` para el caso denegado
          (negativa registrada, no fila ausente)

---

## Fase 5 — UI (aviso + casilla)

- [x] **T5.1** — Ampliar el bloque informativo de `psych-test-intro`
  - **AC ref:** AC1
  - **DoD:**
    - [x] Agrega, en el mismo estilo visual existente (icon + texto, sin superficie nueva): dato de
          salud psíquica, quién trata (`privacyPolicy()?.legalName`), para qué, retención (12
          meses), evaluado por persona (no programa)
    - [x] Agrega el aviso de que un resultado "no apto" puede impedir la matrícula
    - [x] Texto transcrito literal de `.compliance/docs/conductores/21719-consentimiento.md` §4 bis
          — sin redactar contenido nuevo
    - [x] Verificado visualmente con Playwright MCP (`ng serve` local, flujo público real hasta
          `psych-test-intro`, sede Conductores Chillán): aviso de salud psíquica, "un profesional",
          "12 meses" y advertencia de bloqueo por "no apto" renderizan correctamente. **Nota:** el
          shell público (`public-wizard-shell`) no implementa modo oscuro — comportamiento
          preexistente del flujo, no introducido por esta spec; no aplica la verificación en oscuro

- [x] **T5.2** — Casilla de autorización Art. 16
  - **AC ref:** AC2, AC-E1
  - **DoD:**
    - [x] Casilla propia, **no premarcada**, separada de cualquier otra aceptación del flujo
    - [x] `data-llm-action="accept-psych-test-consent"`
    - [x] Bound a `facade.psychTestConsent()` / `facade.setPsychTestConsent()`
    - [x] Botón "Responder ahora" deshabilitado hasta marcar la casilla
    - [x] Botón "Prefiero rendirlo en la sede" **sigue habilitado** sin marcarla (AC3 — la
          preinscripción se completa igual sin el test)
    - [x] Texto de la casilla = literal del Anexo 4 §4 bis
    - [x] Verificado con Playwright MCP: casilla visible y no premarcada, click la marca (checkbox
          pasa a `checked`) y el botón "Responder ahora" cambia de deshabilitado (gris) a habilitado
          (azul) en el mismo instante; "Prefiero rendirlo en la sede" siempre habilitado

---

## Fase 6 — Lectura en admin (AC5)

- [x] **T6.1** — Sección de consentimiento en `admin-pre-inscrito-drawer.component.ts`
  - **AC ref:** AC5
  - **DoD:**
    - [x] Carga vía `effect()` + `ConsentsFacade.loadByUser(p.tempUserId)`, filtrado a
          `consentType==='test_psicologico'` (computed `psychConsent`)
    - [x] Solo lectura — mismo trato append-only que la `0009-m` (sin editar/eliminar desde acá)
    - [x] Muestra estado (otorgado/rechazado/revocado vía `app-badge`) y fecha — versión compacta
          embebida en el tab existente (no replica IP/policy version del drawer completo de
          `0009-m`; esa vista detallada ya existe en la ficha del alumno una vez matriculado)
    - [x] Verificado por el usuario (QA manual, login de admin real): panel de consentimiento
          renderiza correctamente en el drawer de pre-inscritos

---

## Fase 7 — Validación y cierre

- [x] **T7.1** — Validación completa
  - **DoD:**
    - [x] `npm run lint:arch` — 0 errores (170 advertencias, todas pre-existentes/backlog)
    - [x] `npm run test:ci` — 174 archivos, 2190 tests PASAN, 0 fallos
    - [x] QA visual con Playwright MCP del aviso + casilla en `psych-test-intro` (ver T5.1/T5.2) +
          QA manual del usuario en el drawer de admin (T6.1)
    - [x] `/spec-verify` — 8/8 AC cumplidos con evidencia en `acceptance.md` (veredicto: ✅ PASA)

- [x] **T7.2** — Cierre
  - **DoD:**
    - [x] `indices/DATABASE.md`, `indices/MODELS.md`, `indices/UTILS.md` actualizados
    - [x] `specs/ROADMAP.md` marca `0010-m` como cerrada (Done, 8/8 AC ✅ PASA)
    - [x] `specs/.active` vaciado
