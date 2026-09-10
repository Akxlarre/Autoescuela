# Spec 0040-b — Finalidades de consentimiento para comunicaciones al alumno (Ley 21.719)

> **Status:** done
> **Created:** 2026-09-08
> **Owner:** Benjamín
> **Priority:** P0 — **bloqueante de despliegue** (mismo fundamento que 0009-m: la ventana se cierra con el primer alumno real)

---

## 1. Contexto de negocio

**Origen:** Interrogatorio `/grill_me` sobre el sistema de comunicación (2026-09-08). Diagnóstico
completo y decisiones registradas en `indices/NOTIFICATIONS-MAP.md` §9.

**Persona afectada:** Alumno (titular de los datos). En segundo plano el representante legal de la
sociedad, que responde ante la Agencia de Protección de Datos Personales, y la secretaria, que
captura el consentimiento en la vía presencial.

**Problema que resuelve:**

`consents.consent_type` acepta hoy exactamente cuatro finalidades — `matricula_datos`,
`certificado_medico`, `preinscripcion`, `test_psicologico` — y **ninguna cubre comunicaciones
dirigidas al alumno**. El proyecto ya decidió que va a haber canal saliente por email
(`NOTIFICATIONS-MAP.md` §9.2, D-1/D-2) y ya tiene la infraestructura para mandarlo
(`send-certificate-email`, `send-zoom-email`, SMTP propio), pero no tiene dónde registrar que el
alumno consintió recibirlo.

La tabla es **append-only** por trigger y la carga de la prueba del consentimiento es del
responsable (Art. 12). Si la finalidad no existe al momento de matricular, no se puede crear
retroactivamente sin volver a contactar a cada alumno ya matriculado — lo que la spec 0009-m
llama *"el problema más caro y peor resuelto de toda adecuación"*.

**Hipótesis de valor:**

El sistema aún no se despliega. Si esto entra antes del primer alumno real, **ningún alumno queda
jamás sin registro de su preferencia de comunicaciones**, y la decisión de producto sobre el
comunicado global (segmentos, plantillas, UI) queda desbloqueada para tomarse cuando se quiera,
sin deuda legal arrastrada. La ventana para hacerlo barato es exactamente ahora.

---

## 2. User Stories

> **Nota de diseño (resuelta 2026-09-09, consulta al pack `ley-21719` contra el texto oficial):**
> las dos finalidades **no son simétricas** y esta spec cambió de forma para reflejarlo.
> **Operativa** (recordatorio de clase, documento faltante, certificado listo) se ampara en
> **Art. 13 c)** — ejecución del contrato — y **no requiere consentimiento**. Más aún: pedirlo como
> un checkbox de "acepto/rechazo" sería contrario a la ley, porque el **Art. 12 inciso 5** presume
> **no libremente otorgado** el consentimiento que se recaba para algo que de todos modos es
> necesario para ejecutar el contrato. Lo que corresponde es **informar** (deber del **Art. 14
> ter**: finalidad y base de legitimidad), no pedir permiso. **Promocional**, en cambio, es
> consentimiento real bajo **Art. 12** (libre, específico, previo, revocable sin efecto
> retroactivo) y tiene su propio derecho de oposición nombrado en **Art. 8 letra b)** ("fines de
> mercadotecnia o marketing directo").

- **US1**: Como **alumno**, quiero ser **informado** de que recibiré comunicaciones operativas de
  la escuela (clase, documentos, certificados) y bajo qué base legal, para saber qué me van a
  mandar sin que se me pida "aceptar" algo que ya es parte del servicio que contraté.
- **US2**: Como **alumno**, quiero poder **rechazar las comunicaciones promocionales sin que eso
  bloquee mi matrícula**, para no tener que aceptar publicidad como precio de estudiar.
- **US3**: Como **representante legal de la sociedad**, quiero poder demostrar ante una
  fiscalización que informé la finalidad operativa y que registré el consentimiento promocional de
  cada alumno — cuándo, desde qué IP y bajo qué versión de la política — para cumplir con la carga
  de la prueba del Art. 12 y el deber de información del Art. 14 ter.
- **US4**: Como **secretaria**, quiero capturar el mismo registro cuando matriculo
  presencialmente, para que no queden alumnos sin registro según la vía por la que entraron.
- **US5**: Como **alumno**, quiero poder **revocar mi consentimiento promocional yo mismo**, en
  cualquier momento y sin tener que pedírselo a un admin, porque el Art. 12 exige que el medio de
  revocación esté "permanentemente disponible" para el titular — no es una feature opcional, es
  el requisito para que ese consentimiento sea válido.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given la migración aplicada, When se inserta un `consents` con `consent_type =
  'comunicaciones_operativas'` o `'comunicaciones_promocionales'`, Then el insert es aceptado por
  el CHECK y la fila queda persistida.

- **AC2**: Given un alumno completa la matrícula por la **vía pública**, When llega al paso de
  comunicaciones, Then ve un **párrafo informativo** (no un checkbox) sobre `comunicaciones_operativas`
  citando la base legal (ejecución del contrato) y un **checkbox real, desmarcado por defecto**
  para `comunicaciones_promocionales`. Al enviar, queda **una fila por finalidad** en `consents`:
  la operativa con `granted=true` siempre (es un acuse de haber sido informado, no una elección),
  la promocional con `granted` reflejando la casilla — ambas con `policy_version`, `ip` server-side
  y `source='public'`.

- **AC3**: Given el mismo alumno matriculado por la **vía secretaría**, When la secretaria completa
  el paso, Then se persisten las mismas dos filas con `source='secretaria'` — la UI de secretaría
  **no ofrece un checkbox para rechazar la operativa**, mismo criterio que la vía pública.

- **AC4**: Given un alumno **no marca** el checkbox de comunicaciones promocionales, When continúa
  el flujo, Then la matrícula se completa normalmente y queda la fila con `granted=false` — nunca
  bloquea la matrícula. La operativa **no tiene equivalente de "rechazo"**: no puede dejar de
  informarse (Art. 14 ter es un deber del responsable, no una opción del titular).

- **AC5**: Given el allowlist `CONSENT_TYPES` de la Edge Function `public-enrollment`, When llega
  un payload con las finalidades nuevas, Then **no se descartan en silencio** y se persisten
  (hoy la línea 332 filtra por ese `Set` y cualquier tipo no listado se pierde sin error).

- **AC6**: Given la política de privacidad vigente, When el alumno la lee en el punto de captura,
  Then están informadas explícitamente ambas finalidades **con su base legal diferenciada** (Art.
  14 ter d: "la base de legitimidad del tratamiento" — ejecución de contrato para la operativa,
  consentimiento para la promocional) y `policy_version` refleja la versión nueva.

- **AC7**: Given un alumno autenticado en el **portal alumno**, When abre su configuración de
  privacidad, Then ve el estado actual de su consentimiento `comunicaciones_promocionales` (vigente
  / revocado, con fecha) y un control para revocarlo — **medio "expedito, fidedigno, gratuito y
  permanentemente disponible"** (Art. 12).

- **AC8**: Given un alumno revoca su consentimiento promocional desde el portal, When confirma,
  Then se escribe `revoked_at` en **su propia fila** (nueva RLS: el titular puede actualizar
  `revoked_at` de sus propios `consents` con `consent_type='comunicaciones_promocionales'`, mismo
  patrón de columna acotada que ya usa `update_consents_revocation` para admin) y la revocación
  **no tiene efecto retroactivo** (Art. 12) — no borra ni invalida envíos ya hechos.

### Edge cases obligatorios

- **AC-E1**: Given un alumno **menor de edad**, When el apoderado otorga el consentimiento
  promocional, Then la fila queda con `granted_by_representative = true`, igual que las finalidades
  ya existentes. La operativa se registra igual (`granted=true`) independiente de quién matricule.

- **AC-E2**: Given una fila de consentimiento de comunicaciones ya escrita, When se intenta un
  `UPDATE` sobre cualquier columna que no sea `revoked_at`, Then `trg_consents_append_only` lanza
  excepción y el cambio se rechaza — sin excepción para la revocación self-service de AC8, que
  sigue acotada a esa única columna.

- **AC-E3**: Given un payload con un `consentType` desconocido, When llega a la EF, Then se
  descarta sin romper el flujo (comportamiento actual preservado) — la corrección de AC5 amplía
  el allowlist, **no lo elimina**.

- **AC-E4**: Given un alumno intenta revocar (AC8) una fila de `consent_type` que **no** sea
  `comunicaciones_promocionales` (ej. `matricula_datos`), When la policy RLS evalúa la request,
  Then se rechaza — el titular solo puede auto-revocar el consentimiento que es realmente suyo para
  otorgar/negar; la operativa no es revocable porque no es un consentimiento.

---

## 4. Out of scope

> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ **El comunicado global en sí** (envío a segmentos, plantillas, UI de redacción). Es el
  proyecto que esta spec desbloquea, no el que resuelve.
- ❌ Conectar los ~14 productores de notificaciones existentes al canal email.
- ❌ WhatsApp Business API — descartado por costo/dependencia externa (`NOTIFICATIONS-MAP.md` §9.2).
- ❌ Bandeja bidireccional alumno↔escuela (decisión D-1: el sistema avisa, no conversa).
- ❌ Tocar el módulo "Comunicación" (`tasks`/`task_replies`) — se deja como está hasta tener uso real.
- ❌ Revocación self-service de las **otras** finalidades (`matricula_datos`,
  `certificado_medico`, `preinscripcion`, `test_psicologico`) — AC7/AC8 acotan la revocación
  self-service **solo** a `comunicaciones_promocionales`. Extenderla a las demás es otra spec: esas
  no nacieron con ese requisito (no son marketing) y ampliar su RLS sin analizar cada una por
  separado sería scope creep.

---

## 5. Dependencias

### Specs previas
- `0009-m-consentimiento-ley-21719` — ✅ done. Creó la tabla `consents`, el trigger append-only,
  la IP server-side y el deber de información en el punto de captura.
- `0010-m-consentimiento-test-psicometrico` — ✅ done. **Precedente directo del cambio**: agregó
  `test_psicologico` al CHECK (`20260818130000`) con gate de persistencia en dos capas
  (cliente + servidor). Este trabajo replica ese patrón.

### Capacidades del proyecto que se asumen existentes
- Tabla `consents` con RLS, `trg_consents_append_only`, `trg_consents_set_ip`.
- `ConsentsFacade`, `PublicEnrollmentFacade`, `EnrollmentFacade`.
- EF `public-enrollment` con `persistConsents()` y allowlist `CONSENT_TYPES`.
- `privacy-policy.model.ts` como fuente del texto informativo.

### Capacidades nuevas requeridas
- Ninguna tabla nueva. Ampliación del CHECK + propagación a las 5 capas + **una RLS policy nueva**
  para que el titular pueda escribir `revoked_at` en su propia fila de
  `comunicaciones_promocionales` (AC7/AC8) — acotada por columna y por `consent_type`, mismo
  mecanismo de columna restringida que ya usa `update_consents_revocation` para admin.

---

## 6. Datos y modelo (preliminar)

- **Tablas modificadas:** `consents` — ampliar el CHECK de `consent_type` con
  `comunicaciones_operativas` y `comunicaciones_promocionales` (migración idempotente, mismo
  patrón que `20260818130000`).
- **Modelos:** `core/models/dto/consent.model.ts` y `core/models/ui/consent.model.ts`.
- **Edge Function:** `supabase/functions/public-enrollment/index.ts` — `CONSENT_TYPES` (línea ~272)
  y el tipo del `consentType` (línea ~272).
- **Texto legal:** `core/models/ui/privacy-policy.model.ts` + bump de `PRIVACY_POLICY_VERSION`
  (constante global única, reutilizada por todo `consent_type` — así ya lo hacen los 4 existentes,
  no hay versionado por finalidad en el código actual, ver §9).
- **RLS:** **una policy UPDATE nueva** en `consents` — el titular puede escribir `revoked_at` en
  filas propias de `consent_type='comunicaciones_promocionales'` (AC7/AC8). Las policies existentes
  no cambian.

---

## 7. UX y flujos (preliminar)

- **Pantallas afectadas:** paso de contrato/consentimientos del wizard público
  (`public-contract.component.ts`), su equivalente en el wizard de secretaría, y una sección nueva
  en el portal alumno (configuración de privacidad) para AC7/AC8.
- **Flujo principal (matrícula):** **no son dos checkboxes simétricos.** La operativa se muestra
  como párrafo informativo (sin control de aceptar/rechazar); la promocional es el único checkbox
  real, desmarcado por defecto, separado del consentimiento de matrícula.
- **Flujo secundario (portal alumno):** toggle o botón "Dejar de recibir promociones" con
  confirmación, que escribe `revoked_at` directamente vía la RLS nueva — sin pasar por un admin.
- **Estado especial:** no marcar la promocional continúa el flujo sin fricción ni advertencia
  (AC4). No existe forma de "rechazar" la operativa — es información, no una elección.

---

## 8. Métricas de éxito post-launch

- **100%** de las matrículas (pública + secretaría) con al menos una fila de consentimiento de
  comunicaciones. Cero alumnos sin registro.
- Cero intentos de envío a un alumno sin fila `granted=true` de la finalidad correspondiente
  (verificable cuando exista el canal saliente).

---

## 9. Notas / decisiones (resueltas 2026-09-09)

Las 4 decisiones que dejó abiertas el draft inicial se cerraron consultando el pack `ley-21719`
contra el texto oficial (`ley-21719-diariooficial.pdf`, Diario Oficial 13-12-2024):

- [x] **Base legal de las comunicaciones operativas — Art. 13 c).** Es lícito tratar datos sin
  consentimiento cuando el tratamiento "sea necesario para la celebración o ejecución de un
  contrato". Más fuerte todavía: el **Art. 12 inciso 5** presume **no libremente otorgado** el
  consentimiento que se recaba para algo ya necesario para el contrato — pedirlo como checkbox
  sería, en rigor, contrario a la ley. Por eso la operativa se informa (Art. 14 ter), no se
  consiente. Cambió AC2/AC4/AC-E1 y el flujo de §7.
- [x] **Nombres de los `consent_type` — se mantienen** `comunicaciones_operativas` /
  `comunicaciones_promocionales`. Criterio: los 4 `consent_type` existentes ya nombran el
  *contenido* del mensaje, no su base legal (`certificado_medico` no dice "dato sensible Art.
  16"); la asimetría legal vive en el AC y en la UI, no en el nombre de la columna — consistente
  con el patrón en producción.
- [x] **`policy_version` — no había nada que decidir.** El código ya usa una única constante global
  `PRIVACY_POLICY_VERSION` (`privacy-policy.model.ts`) para los 4 `consent_type` existentes, sin
  versionado por finalidad. Las dos finalidades nuevas siguen el mismo patrón.
- [x] **Revocación self-service — entra en esta spec** (AC7/AC8/AC-E4), acotada a
  `comunicaciones_promocionales`. No es una mejora opcional: el **Art. 12** exige que el medio de
  revocación sea "expedito, fidedigno, gratuito y **permanentemente disponible** para el titular" —
  hoy solo un admin puede escribir `revoked_at`, lo que no satisface ese estándar para un
  consentimiento que recién se está creando. Las demás finalidades (`matricula_datos`, etc.)
  quedan fuera — no nacieron con ese requisito porque no son consentimientos de marketing.

---

## Changelog

- 2026-09-08 — draft inicial por Benjamín, derivado del interrogatorio `/grill_me` registrado en
  `indices/NOTIFICATIONS-MAP.md` §9.
- 2026-09-09 — 4 decisiones de §9 resueltas contra el texto oficial de la Ley 21.719 (pack
  `ley-21719` del skill `compliance-cl`). Cambio de diseño: operativa pasa de checkbox a párrafo
  informativo (Art. 13 c + Art. 12 inc. 5); se agrega revocación self-service acotada a
  promocional (AC7/AC8, exigida por Art. 12).
- 2026-09-09 — `status: draft` → `approved`.
