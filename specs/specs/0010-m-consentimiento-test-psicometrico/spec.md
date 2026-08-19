# Spec 0010-m — Consentimiento del test psicométrico EPQ (Ley 21.719, Art. 16)

> **Status:** done
> **Created:** 2026-08-17
> **Owner:** Matías
> **Priority:** P0 — **bloqueante de despliegue**
> **Alcance:** solo **Conductores Chillán** (los cursos profesionales son suyos)

---

## 1. Contexto de negocio

**Origen:** hallazgo `H-2026-08-17-epq`, detectado al implementar la spec `0009-m`. **No lo detectó la
corrida 1 de la auditoría** `.compliance/`: el test psicométrico no aparecía en el RAT, ni en la EIPD, ni
en la política de privacidad de ninguna de las dos sociedades.

**Persona afectada:** el interesado que se preinscribe en línea a un curso profesional. En segundo plano,
el profesional que evalúa el test y el representante legal de la sociedad.

**Problema que resuelve:**

La preinscripción profesional en línea aplica el **EPQ — Eysenck Personality Questionnaire**, un
instrumento psicométrico clínico de **81 ítems Sí/No**
(`core/utils/epq-questions.const.ts`), y persiste en `professional_pre_registrations`:

- `psych_test_answers` — las **81 respuestas individuales**
- `psych_test_result` — `fit` / `unfit`
- `psych_rejection_reason` — el motivo del rechazo

Eso es **dato sensible de salud psíquica** bajo el Art. 2, y el Art. 16 exige para él consentimiento
**expreso y específico para ese dato** — el mismo régimen que el certificado médico. Hoy el formulario
público **no pide ninguna autorización**: el interesado responde 81 preguntas sobre su personalidad y las
respuestas se guardan sin que nadie le haya dicho que son un dato de salud, para qué se usan ni cuánto
duran.

**Lo que NO es un problema, y conviene dejar dicho:**

El resultado **no se calcula automáticamente**. La Edge Function deja `psych_test_result` en `NULL` de
forma deliberada (`supabase/functions/public-enrollment/index.ts:823` — *"lo determina el psicólogo"*) y
solo un profesional identificado lo fija después (`psych_evaluated_by`). Si el sistema puntuara el test
solo, habría además una **decisión automatizada con efecto significativo** (Art. 8 bis) y esta spec sería
mucho más grande. **Si algún día se automatiza el puntaje, hay que rehacer la EIPD antes de activarlo.**

Y ya existe una vía sin dato sensible digitalizado: el interesado puede **omitir el test en línea** y
rendirlo en papel (`submitPreInscription({ skipTest })` guarda `psych_test_status: 'not_started'` sin
respuestas), y el panel de administración ofrece **descargar el test en blanco** para llenarlo a mano.

**Hipótesis de valor:**

Igual que la `0009-m`: **el sistema aún no se despliega**, así que **no existe todavía ninguna respuesta
recolectada**. Corregirlo ahora cuesta una casilla. Corregirlo después obliga a pedirle autorización
retroactiva a cada preinscrito o a borrar sus respuestas — y a explicarle a la Agencia por qué se
recolectaron datos de salud sin consentimiento.

---

## 2. User Stories

- **US1**: Como **interesado en un curso profesional**, quiero que me digan **antes de responder** que el
  cuestionario trata datos sobre mi salud psíquica, para decidir si lo respondo en línea o en papel.
- **US2**: Como **interesado**, quiero **autorizar expresamente y por separado** el tratamiento de mis
  respuestas, sin que vaya implícito en aceptar una preinscripción.
- **US3**: Como **representante legal de la escuela**, quiero poder acreditar ante la Agencia que cada
  set de respuestas almacenado tiene su autorización.
- **US4**: Como **psicólogo evaluador**, quiero seguir viendo las 81 respuestas de quien sí autorizó,
  porque necesito evaluarlas ítem por ítem y poder re-evaluarlas.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given un interesado en el paso del test psicométrico del flujo público, When la pantalla carga
  y **antes de mostrar la primera pregunta**, Then ve un aviso de que el cuestionario trata **datos de su
  salud psíquica**, quién los trata, para qué, por cuánto tiempo, que **lo evalúa una persona y no un
  programa**, que un resultado **"no apto" puede impedir su matrícula** al curso profesional, y que puede
  rendirlo en papel en la escuela.

- **AC2**: Given ese mismo paso, When llega al bloque de aceptación, Then ve una casilla de
  **autorización expresa del Art. 16**, **no premarcada** y **separada de toda otra aceptación**, con el
  texto del **Anexo 4 §4 bis** de `.compliance/docs/conductores/21719-consentimiento.md`.

- **AC3**: Given un interesado que **no marca** esa casilla, When avanza, Then **no se persiste ninguna
  respuesta** (`psych_test_answers` queda vacío y `psych_test_status = 'not_started'`), la preinscripción
  **se completa igual**, y se le indica que rendirá el test presencialmente.

- **AC4**: Given un interesado que **sí marca** la casilla y responde, When se envía la preinscripción,
  Then queda un registro en `consents` con `consent_type = 'test_psicologico'`, su `granted_at`, su IP,
  la versión de política y `branch_id` de Conductores Chillán.

- **AC5**: Given un administrador, When consulta los consentimientos de un preinscrito, Then ve el del
  test psicométrico junto a los demás, con el mismo tratamiento append-only de la `0009-m`.

### Edge cases obligatorios

- **AC-E1**: Given un interesado que marca la casilla pero **abandona a mitad** del cuestionario, When no
  envía la preinscripción, Then no queda ni consentimiento ni respuestas — el consentimiento se registra
  con el envío, no con el clic en la casilla.

- **AC-E2**: Given un interesado **menor de edad**, When llega al test, Then aplica el mismo criterio de
  la `0009-m` (AC7): el consentimiento lo otorga su representante legal y el registro lo refleja.

- **AC-E3**: Given un preinscrito que autorizó y luego **revoca**, When se procesa la revocación, Then se
  marca `revoked_at` sin borrar el registro, **y** se define qué pasa con las respuestas ya almacenadas
  (ver §9 — decisión abierta).

---

## 4. Out of scope

> Explícito. Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ **Reducir lo que se almacena del test.** Se evaluó y **se descartó**: el titular del negocio
  confirmó el 17-08-2026 que las **81 respuestas crudas son necesarias** porque un profesional debe
  evaluarlas ítem por ítem y puede re-evaluarlas. Queda declarado así en el RAT (actividad 15) como
  justificación de necesidad, que es lo que el principio de minimización exige: no "guardamos todo por si
  acaso", sino "guardamos esto porque sin esto no se puede evaluar".
- ❌ **Automatizar el puntaje del EPQ.** Además de estar fuera de alcance, **activarlo cambiaría el
  régimen legal** (decisión automatizada, Art. 8 bis) y obligaría a rehacer la EIPD.
- ❌ **El flujo del certificado médico** — es de la `0009-m`.
- ❌ **Aplicar esto a Autoescuela Chillán (OTEC).** No tiene cursos profesionales ni preinscripción con
  test.

---

## 5. Dependencias

### Specs previas
- **`0009-m`** — **dependencia dura**. Esta spec reutiliza la tabla `consents`, el `ConsentsFacade`, el
  `consent-builder.utils` y la ruta pública de política de privacidad. No se puede implementar antes.

### Capacidades del proyecto que se asumen existentes
- Flujo público de preinscripción profesional con su paso de test (`PsychTestComponent`, importado solo
  por `public-enrollment.component.ts`).
- `submitPreInscription({ skipTest })` — la vía que ya permite no responder en línea.
- Edge Function `public-enrollment`, que es quien persiste y quien tiene la IP del cliente.
- Descarga del test en blanco desde el panel de administración.

### Capacidades nuevas requeridas
- Valor `test_psicologico` en el CHECK de `consents.consent_type` (migración de una línea).
- Aviso y casilla en el paso del test.
- Gate en la Edge Function: sin consentimiento otorgado, **no se persisten respuestas**.

---

## 6. Datos y modelo (preliminar)

No hay tabla nueva. Cambios:

| Qué | Cambio |
|---|---|
| `consents.consent_type` | Agregar `test_psicologico` al CHECK |
| `ConsentType` (`core/models/dto/consent.model.ts`) | Agregar el mismo valor |
| `CONSENT_TYPE_LABELS` | `'Test psicométrico EPQ (dato de salud psíquica)'` |
| `professional_pre_registrations` | **Sin cambios de esquema.** Lo que cambia es cuándo se escribe |

---

## 7. UX y flujos (preliminar)

| Pantalla | Cambio |
|---|---|
| `public-enrollment-steps/` — paso del test (`PsychTestComponent`) | Aviso Art. 14 ter específico del dato de salud + casilla Art. 16, **antes** de la primera pregunta |
| Edge Function `public-enrollment` | Gate de persistencia + registro del consentimiento |
| Ficha/drawer de preinscrito (admin) | El consentimiento aparece en el panel de la `0009-m` |

**Fuente de los textos:** `.compliance/docs/conductores/21719-consentimiento.md` **§4 bis**. **No
redactar textos nuevos.**

> ⚠️ **Trampa a evitar:** poner la casilla *después* de las 81 preguntas. Para cuando el interesado la
> viera, ya habría respondido — el consentimiento tiene que ser **previo** (Art. 12), no una
> confirmación al final.

---

## 8. Métricas de éxito post-launch

- **Cero filas** en `professional_pre_registrations` con `psych_test_answers` no vacío y sin su
  consentimiento `test_psicologico` asociado. Una sola es un incidente, no una estadística.

---

## 9. Decisiones (confirmadas por el dueño, 2026-08-18)

- **AC-E3 — revocación:** Se **conservan** las respuestas y el resultado ya emitido. Revocar solo marca
  `revoked_at` en `consents`, sin borrar ni anonimizar `psych_test_answers`/`psych_test_result` — el
  veredicto del psicólogo ya emitido es parte del expediente del alumno y no se pierde con la revocación
  del consentimiento de tratamiento futuro.
- **AC1 — aviso de bloqueo:** Confirmado que `unfit` marca la preinscripción como `rejected`
  (`admin-pre-inscritos.facade.ts:161`) — sí condiciona el acceso real al curso. El aviso previo al test
  **debe decir explícitamente** que un resultado "no apto" puede impedir la matrícula al curso
  profesional, antes de que el interesado responda.
- **Retención:** Confirmados **12 meses**, igual que el resto de la preinscripción — sin excepción para
  el dato sensible del EPQ.

---

## Changelog

- 2026-08-17 — draft inicial. Origen: hallazgo `H-2026-08-17-epq`, detectado durante la implementación de
  la `0009-m` y **no cubierto por la corrida 1** de la auditoría `.compliance/`. Documentos del
  expediente ya corregidos: RAT (actividad 15), EIPD (R-8, M-11, M-12, tercera vía del Art. 15 ter),
  política (§2, §3, §5) y consentimientos (§4 bis).
