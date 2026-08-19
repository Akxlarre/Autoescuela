# Plan 0010-m — Consentimiento del test psicométrico EPQ (Ley 21.719, Art. 16)

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-08-18
> **Talla:** **S** — reutiliza casi todo de la `0009-m` (`ConsentsFacade`, `consent-builder.utils`,
> `persistConsents` de la Edge Function). Sin facade nuevo, sin componente nuevo (el aviso y la
> casilla van dentro de la pantalla `psych-test-intro` que ya existe). Estimado < 1 día.

---

## 1. Impacto (Discovery)

**Punto de entrada ya existe y es exactamente donde tiene que ir el aviso:** la pantalla
`psych-test-intro` en `public-enrollment.component.ts:276-402` ya se muestra **antes** de la primera
pregunta, con los botones "Responder ahora" / "Prefiero rendirlo en la sede". Solo falta agregarle el
aviso Art. 14 ter del dato de salud + la casilla Art. 16 — no hay que crear una pantalla nueva.

**El patrón de consentimiento del dato sensible ya existe** — `consent-builder.utils.ts` tiene
`buildMedicalCertificateConsent()`, construido en la `0009-m` para el mismo régimen legal (Art. 16,
datos de salud). El del EPQ es la misma forma: un solo draft, `consentType` distinto, `source:
'public'` en vez de `'secretaria'` (acá el dato sí entra por el flujo online, a diferencia del
certificado médico).

**El gate de persistencia también tiene precedente:** `handleSubmitPreInscription()` en la EF ya
tiene la rama `omitsPsychTest` que fuerza `psych_test_answers: null` — solo hay que agregar una
segunda condición que la fuerce también cuando no venga el consentimiento otorgado, sin confiar en lo
que mande el cliente.

### Archivos a MODIFICAR (ninguno a crear)

| Path | Cambio |
|------|--------|
| `supabase/migrations/<timestamp>_consents_add_test_psicologico.sql` | Agregar `'test_psicologico'` al CHECK de `consents.consent_type` |
| `src/app/core/models/dto/consent.model.ts` | `ConsentType` suma `'test_psicologico'` |
| `src/app/core/models/ui/consent.model.ts` | `CONSENT_TYPE_LABELS['test_psicologico'] = 'Test psicométrico EPQ (dato de salud psíquica)'` |
| `src/app/core/utils/consent-builder.utils.ts` | Nueva función `buildPsychTestConsent(input)` — mismo patrón que `buildMedicalCertificateConsent()`, `source: 'public'` |
| `src/app/core/utils/consent-builder.utils.spec.ts` | Casos: casilla marcada → `granted:true`; no marcada → `granted:false` (AC3, la negativa se registra igual) |
| `src/app/core/facades/public-enrollment.facade.ts` | Signal `_psychTestConsent` (boolean, default `false`); expone `psychTestConsent`/`setPsychTestConsent()`; `submitPreInscription()` arma el draft con `buildPsychTestConsent()` y lo agrega a `body.consents`; si `!granted`, fuerza `skipTest: true` sin importar `psychTestAnswers()` (AC3 — el gate también vive en el cliente, no solo en la EF) |
| `src/app/core/facades/public-enrollment.facade.spec.ts` | Cubre: casilla no marcada + respuestas ya cargadas → `submitPreInscription()` manda `skipPsychTest:true` igual (AC3/AC-E1) |
| `src/app/features/public-enrollment/public-enrollment.component.ts` | En el `@case ('psych-test-intro')`: (1) ampliar el bloque informativo con el texto del Anexo 4 §4 bis (quién trata, para qué, cuánto tiempo, evaluado por persona, aviso de que "no apto" puede impedir la matrícula); (2) casilla `data-llm-action="accept-psych-test-consent"` **no premarcada**, propia — no reutiliza ninguna casilla existente; (3) botón "Responder ahora" deshabilitado hasta marcarla |
| `supabase/functions/public-enrollment/index.ts` | `CONSENT_TYPES` suma `'test_psicologico'`; `handleSubmitPreInscription()` — el gate de persistencia se calcula server-side: `omitsPsychTest = skipPsychTest === true \|\| !hasGrantedPsychConsent(body.consents)`, **nunca confiar solo en `skipPsychTest` del payload** |
| `src/app/features/admin/alumnos/pre-inscritos/admin-pre-inscrito-drawer.component.ts` | AC5 — sección de solo lectura con el consentimiento del test (vía `ConsentsFacade.loadByUser(tempUserId)`, filtrado a `consentType==='test_psicologico'`), mismo trato append-only que la `0009-m` |
| `indices/DATABASE.md`, `indices/MODELS.md`, `indices/UTILS.md` | Alta de `test_psicologico` y de `buildPsychTestConsent()` |

---

## 2. Modelo de datos

```sql
-- supabase/migrations/<timestamp>_consents_add_test_psicologico.sql
ALTER TABLE consents DROP CONSTRAINT consents_consent_type_check;
ALTER TABLE consents ADD CONSTRAINT consents_consent_type_check
  CHECK (consent_type IN ('matricula_datos','certificado_medico','preinscripcion','test_psicologico'));
```

Sin cambios en `professional_pre_registrations` — el AC4 (revocación conserva las respuestas) no
requiere columna nueva: `consents.revoked_at` ya es la única columna actualizable del registro
append-only, y las 81 respuestas siguen viviendo donde siempre.

---

## 3. Gate de persistencia (AC3, el punto que más fácil se implementa mal)

Dos capas, ninguna confía en la otra:

1. **Cliente** (`public-enrollment.facade.ts`): si `psychTestConsent()` es `false`, `submitPreInscription()`
   manda `skipPsychTest: true` sin importar si `psychTestAnswers()` ya tiene las 81 respuestas
   cargadas (ej: alguien que respondió todo, desmarcó la casilla y de todos modos hizo submit por un
   flujo de navegador raro).
2. **Servidor** (Edge Function): `handleSubmitPreInscription()` no confía en `skipPsychTest` del
   payload — recalcula `omitsPsychTest` mirando si `body.consents` trae un draft `test_psicologico`
   con `granted:true`. Sin ese draft (o con `granted:false`), fuerza `psych_test_answers: null` y
   `psych_test_status: 'not_started'`, **aunque lleguen 81 respuestas en el body**.

La EF es la que manda — el chequeo del cliente es UX (evita el submit inútil), no la garantía legal.

---

## 4. Aviso (AC1) — contenido, no diseño nuevo

El bloque informativo de `psych-test-intro` ya tiene 3 líneas (81 preguntas / 10-15 min / sin
respuestas correctas). Se agregan, en el mismo estilo visual (`app-icon` + texto), sin nueva
superficie:

- Es un dato de **salud psíquica** (Art. 2) — quién lo trata (la sociedad de la sede), para qué
  (evaluar aptitud), por cuánto tiempo (12 meses si no se matricula, confirmado en spec §9).
- Lo evalúa **un profesional identificado**, nunca un programa.
- Un resultado **"no apto" puede impedir la matrícula** al curso (confirmado con el dueño — `unfit`
  marca la preinscripción como `rejected`).

Todo el texto sale de `.compliance/docs/conductores/21719-consentimiento.md` §4 bis — no se redacta
nada nuevo, se transcribe.

---

## 5. Restricciones aplicables

Reglas: `architecture.md` (Facade estricto, sin lógica nueva fuera del util puro), `facades.md`
(`public-enrollment.facade.ts` ya existente, sin branch-scope nuevo), `models.md` (extender el union
type existente, no duplicar), `ai-readability.md` (`data-llm-action` en la casilla nueva),
`testing-tdd.md` (spec obligatorio para `consent-builder.utils` y el facade).

---

## 6. Plan de testing

- **`consent-builder.utils.spec.ts`**: `buildPsychTestConsent()` — marcada → `granted:true`; no
  marcada → `granted:false` (AC3, la negativa se registra igual que en `0009-m`).
- **`public-enrollment.facade.spec.ts`**: `submitPreInscription()` con `psychTestConsent()===false` y
  81 respuestas ya en el signal → igual manda `skipPsychTest:true` (defensa cliente del gate).
- **Integración (Supabase local)**: INSERT a `professional_pre_registrations` vía la EF con
  `consents: []` (sin draft `test_psicologico`) → `psych_test_answers` queda `NULL` aunque el body
  lleve 81 respuestas — prueba directa del gate server-side.
- **QA manual / `/verify`**: pre-inscripción profesional completa sin marcar la casilla (test se
  omite, mensaje de "rendir en la sede") y marcándola (test se guarda + consentimiento visible en el
  drawer de admin). Confirmar aviso de "no apto puede impedir matrícula" visible antes de la primera
  pregunta.

---

## 7. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| El cliente manda `skipPsychTest:false` con respuestas pero sin el draft de consentimiento (bug de UI o manipulación directa del payload) | Gate server-side recalcula `omitsPsychTest` desde `body.consents`, no confía en el flag del cliente (§3) |
| Migración del CHECK con downtime en `consents` si hay filas en vuelo | Tabla nueva desde la `0009-m`, aún sin tráfico en producción (sistema no desplegado) — bajo riesgo real |

---

## 8. Orden de implementación

1. Migración del CHECK.
2. Modelos (`ConsentType`, `CONSENT_TYPE_LABELS`) + `buildPsychTestConsent()` con su spec (TDD).
3. `public-enrollment.facade.ts` — signal + gate cliente + spec.
4. Edge Function — `CONSENT_TYPES` + gate server-side.
5. UI — aviso ampliado + casilla en `psych-test-intro`.
6. AC5 — sección de consentimiento en `admin-pre-inscrito-drawer`.
7. `npm run lint:arch` + `npm run test:ci` + `/verify` + `/spec-verify` + sincronizar `indices/`.

---

## Changelog

- 2026-08-18 — plan inicial (Talla S). Cierra las 3 decisiones abiertas de la spec §9 (revocación,
  aviso de bloqueo, retención) antes de planificar.
