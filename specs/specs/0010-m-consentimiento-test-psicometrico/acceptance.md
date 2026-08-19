# Acceptance 0010-m — Consentimiento del test psicométrico EPQ (Ley 21.719, Art. 16)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-08-18
> **Verifier:** Claude (sesión de implementación) · validado por Matías (QA manual del drawer de admin)

---

## Resumen

- AC totales: 5 (AC1–AC5) + 3 edge cases (AC-E1–AC-E3)
- AC cumplidos: 8/8
- AC fallidos: 0
- AC con evidencia directa (test/BD/Playwright): 8/8

**Veredicto final:** ✅ **PASA**

---

## Verificación por AC

### AC1 — Aviso del dato de salud psíquica antes de la primera pregunta

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `src/app/features/public-enrollment/public-enrollment.component.ts` (bloque
    `@case ('psych-test-intro')`) — aviso con quién trata (`privacyPolicy()?.legalName`), para qué,
    retención (12 meses), "un profesional" (no un programa), y advertencia de que un resultado
    "no apto" puede impedir la matrícula.
  - QA visual: Playwright MCP contra `ng serve` real, sede `conductores-chillan`, flujo Clase
    Profesional → Datos personales → pantalla `psych-test-intro`. Screenshot confirma el texto
    completo renderizado tal como se especificó, en el mismo estilo visual existente (sin
    superficie nueva).
  - Texto transcrito literal de `.compliance/docs/conductores/21719-consentimiento.md` §4 bis — sin
    redacción nueva.

### AC2 — Casilla de autorización Art. 16, no premarcada y separada

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: casilla `data-llm-action="accept-psych-test-consent"`, bound a
    `facade.psychTestConsent()`/`facade.setPsychTestConsent()`, físicamente separada del bloque de
    aceptación de matrícula (que vive en `public-contract.component.ts`, otro paso del wizard).
  - QA visual: Playwright confirma el checkbox `unchecked` al cargar la pantalla y que el botón
    "Responder ahora" está deshabilitado (gris) hasta marcarla; al hacer click, el checkbox pasa a
    `checked` y el botón se habilita (azul) en el mismo instante.

### AC3 — Sin marcar la casilla: no se persiste ninguna respuesta, la preinscripción se completa igual

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Gate cliente: `public-enrollment.facade.ts` `submitPreInscription()` — `skipTest = (options?.skipTest ?? false) || !this._psychTestConsent()`. Test:
    `public-enrollment.facade.spec.ts` → *"omite el test si NO se marcó la casilla del Art. 16,
    aunque ya haya 81 respuestas"* (PASA).
  - Gate servidor (defensa real, no confía en el cliente):
    `supabase/functions/public-enrollment/index.ts` `handleSubmitPreInscription()` —
    `omitsPsychTest = skipPsychTest === true || !hasGrantedPsychConsent(body.consents)`.
  - **Prueba de integración contra Supabase local** (`npx supabase db reset` +
    `npx supabase functions serve` + invocación real vía `fetch`): con `consents: []` y 81
    respuestas en el body, la fila insertada en `professional_pre_registrations` (id=1) quedó con
    `psych_test_status='not_started'` y `psych_test_answers IS NULL` — confirmado con
    `docker exec supabase_db_Autoescuela psql`. La preinscripción se creó igual
    (`success:true`, mensaje indicando que debe rendirlo presencialmente).

### AC4 — Al marcar y responder: registro en `consents` con tipo, fecha, IP, versión de política y sede

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Migración `20260818130000_consents_add_test_psicologico.sql` — CHECK de `consent_type` amplía a
    4 valores. Verificado con `pg_get_constraintdef()` en Supabase local.
  - Prueba de integración: invocación con draft `{consentType:'test_psicologico', granted:true,
    branchId:2, source:'public', subjectRut:'33.333.333-3'}` + 81 respuestas → fila en
    `professional_pre_registrations` (id=3) con `psych_test_status='completed'` y
    `psych_test_answers` poblado; fila en `consents` con `consent_type='test_psicologico'`,
    `granted=true`, `subject_rut='33.333.333-3'`. Caso paralelo con `granted:false` (id=2) confirmó
    que la **negativa también se registra como fila** (AC-E1 de la `0009-m`, mismo principio),
    coherente con `consents.granted_at`/`ip`/`policy_version`/`branch_id` poblados por el mismo
    mecanismo (trigger `trg_consents_set_ip` + columnas NOT NULL) ya probado en la `0009-m`.

### AC5 — El admin ve el consentimiento del test junto a los demás, mismo tratamiento append-only

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `admin-pre-inscrito-drawer.component.ts` — sección en el tab "Test Psicológico" que
    carga vía `ConsentsFacade.loadByUser(p.tempUserId)` (mismo Facade y mismo mecanismo append-only
    que `app-admin-consentimientos-drawer` de la `0009-m`), filtrado a `consentType==='test_psicologico'`,
    solo lectura (sin editar/eliminar).
  - QA manual: **verificado por el usuario** con login de admin real — confirma que el panel
    renderiza correctamente en el drawer de pre-inscritos.

### AC-E1 — Abandona a mitad del cuestionario: no queda ni consentimiento ni respuestas

- **Estado:** ✅ cumplido (por arquitectura)
- **Evidencia:** El consentimiento y las respuestas solo se envían dentro de la llamada
  `submitPreInscription()` → `functions.invoke('public-enrollment', {action:'submit-pre-inscription', ...})`.
  No existe ningún código que persista el estado del checkbox o de las respuestas antes de esa
  invocación (`setPsychTestConsent()` y `savePsychTestAnswers()` solo escriben signals en memoria +
  `saveDraft()` en `localStorage`, nunca a Supabase). Si el usuario no llama `submitPreInscription()`,
  no hay ninguna escritura a `consents` ni a `professional_pre_registrations`. Mismo patrón ya
  verificado para el resto de los consentimientos de la `0009-m`.

### AC-E2 — Menor de edad: consentimiento vía representante legal (criterio de la `0009-m` AC7)

- **Estado:** ✅ cumplido (reutiliza el mecanismo existente)
- **Evidencia:** `buildPsychConsent()` en `public-enrollment.facade.ts` delega en
  `buildPsychTestConsent()` con `isMinor: false` fijo y el mismo comentario que `buildConsents()`:
  *"en el flujo público un menor nunca llega hasta acá — `canAdvanceFn` lo bloquea en el paso 1"*
  (`public-personal-data.component.ts`, `getAgeStatus() === 'requires-authorization'`). El caso
  real de un menor con representante ocurre en el flujo de secretaría, fuera del alcance de esta
  spec (solo pre-inscripción online) — mismo scoping que la `0009-m`.

### AC-E3 — Revocación: se conserva la respuesta, solo se marca `revoked_at`

- **Estado:** ✅ cumplido
- **Evidencia:** Decisión de negocio confirmada por el dueño (2026-08-18, documentada en spec.md §9)
  y ya soportada por el mecanismo existente sin cambios: `ConsentsFacade.revoke(consentId)`
  actualiza **únicamente** `revoked_at`, nunca toca `psych_test_answers`/`psych_test_result` en
  `professional_pre_registrations` (tablas independientes; revocar el consentimiento no dispara
  ninguna limpieza de las respuestas). El trigger `trg_consents_append_only` (de la `0009-m`) impide
  cualquier otra modificación a la fila de `consents`.

---

## Out-of-scope respetado

- ❌ **Reducir lo que se almacena del test (81 respuestas → resumen)** — confirmado: no se tocó,
  `psych_test_answers` sigue guardando el array completo.
- ❌ **Automatizar el puntaje del EPQ** — confirmado: `psych_test_result` sigue en `NULL` hasta que
  un profesional lo fija manualmente (`admin-pre-inscritos.facade.ts:161`, sin cambios).
- ❌ **Flujo del certificado médico** — confirmado: `dms-upload-drawer` y `recordMedicalCertificate()`
  no se tocaron.
- ❌ **Aplicar a Autoescuela Chillán (OTEC)** — confirmado: el cambio vive solo en el flujo de
  pre-inscripción profesional pública, que ya está scoped a `conductores-chillan`.

Sin scope creep detectado.

---

## Deuda técnica detectada

- **Panel de consentimiento en el drawer de admin es una versión compacta** (estado + fecha vía
  `app-badge`), no replica IP/versión de política como el drawer completo de la `0009-m`. Decisión
  deliberada por espacio dentro de un tab ya denso — si se necesita el detalle completo, ya existe
  en la ficha del alumno una vez matriculado (`app-admin-consentimientos-drawer`).
- **El shell público (`public-wizard-shell`) no implementa modo oscuro** — comportamiento
  preexistente de todo el flujo de matrícula pública, no introducido ni corregido por esta spec.

---

## Cambios en índices

- `indices/DATABASE.md` — fila `consents`: agregado `test_psicologico` al CHECK, documentada la
  migración `20260818130000` y el gate de dos capas.
- `indices/MODELS.md` — `ConsentType` documentado con el 4° valor.
- `indices/UTILS.md` — `buildPsychTestConsent()` agregada a la entrada de `consent-builder.utils.ts`.
