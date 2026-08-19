# Spec 0009-m — Registro de consentimiento y deber de información (Ley 21.719)

> **Status:** **done** (2026-08-18) — 7/7 AC + 3/3 edge cases vigentes. Ver [acceptance.md](./acceptance.md)
> **Created:** 2026-08-16
> **Owner:** Matías
> **Priority:** P0 — **bloqueante de despliegue**

---

## 1. Contexto de negocio

**Origen:** Auditoría de cumplimiento `/.compliance/` (corrida 1, 2026-08-16), realizada con el skill
`compliance-cl` sobre el pack `ley-21719`. Ver `.compliance/RESUMEN.md` y las EIPD de ambas sociedades.

**Persona afectada:** Alumno (titular de los datos) y Secretaria (quien matricula). En segundo plano, el
representante legal, que es quien responde ante la Agencia de Protección de Datos Personales.

**Problema que resuelve:**

La Ley 21.719 entra en vigencia el **1 de diciembre de 2026** y pone la **carga de la prueba del
consentimiento en el responsable** (Art. 12). Hoy la app tiene un solo checkbox —"He leído y acepto los
términos y condiciones"— que mezcla el contrato de matrícula con el tratamiento de datos personales y
con el certificado médico, que es un **dato sensible de salud** y exige consentimiento **expreso y
separado** (Art. 16). Además, **nada de eso se persiste**: no existe tabla de consentimientos. Ante una
fiscalización, la pregunta es "muéstreme que este alumno consintió" y hoy no hay nada que mostrar.

A eso se suma que el **deber de información** (Art. 14 ter) no se cumple en el punto de captura: el
alumno entrega su RUT, domicilio y fecha de nacimiento sin que se le informe quién trata sus datos, para
qué, por cuánto tiempo ni cómo ejercer sus derechos.

**Hipótesis de valor:**

El sistema **aún no se despliega**: la base de datos empieza a poblarse el día del deploy. Si esto entra
antes, **ningún alumno queda jamás sin registro de consentimiento** y no hay que recolectarlo
retroactivamente — que es el problema más caro y peor resuelto de toda adecuación. La ventana para
hacerlo barato es exactamente ahora y se cierra con el primer alumno real.

---

## 2. User Stories

- **US1**: Como **alumno**, quiero saber **quién trata mis datos, para qué y por cuánto tiempo** antes de
  entregarlos, para decidir con información.
- **US2**: Como **alumno**, quiero **autorizar por separado** el tratamiento de mi certificado médico,
  porque es información de salud y no quiero que vaya implícita en aceptar un contrato.
- **US3**: Como **representante legal de un alumno menor de edad**, quiero otorgar yo esos
  consentimientos, porque mi hijo no puede hacerlo válidamente.
- **US4**: Como **representante legal de la escuela**, quiero poder **acreditar ante la Agencia** qué
  aceptó cada alumno, cuándo y bajo qué versión de la política, para no depender de la memoria de nadie.
- **US5**: Como **secretaria**, quiero que el sistema **no me deje subir un certificado médico sin la
  autorización correspondiente**, para no incurrir en una infracción sin darme cuenta.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given un visitante en el **primer paso que captura datos personales** del flujo público
  (`public-personal-data`), When la pantalla carga, Then ve un **aviso del Art. 14 ter** con la identidad
  del responsable, la finalidad, el plazo de conservación y el correo del canal de derechos, más un
  enlace a la política de privacidad.

  **En la matrícula presencial el aviso viaja en el contrato que el alumno lee y firma**
  (cláusula QUINTA, `supabase/functions/_shared/contract-pdf.ts`), no en la pantalla.

  > ⚠️ **Corregido el 2026-08-18.** El AC decía "ídem en el paso equivalente del flujo de secretaría", y
  > así se implementó primero. Es incorrecto: **esa pantalla la ve la secretaria, no el titular.** Un
  > aviso en segunda persona ("tus datos") dirigido a quien no lo lee no cumple el deber de informar y no
  > deja evidencia de nada. El canal correcto para el flujo presencial es el contrato firmado —que además
  > es prueba acreditable ante la Agencia— y es donde el propio Anexo 4 §3 del expediente lo ubica desde
  > el principio: *"en la ficha de matrícula (en línea y en papel), junto a la firma del contrato"*.
  >
  > De paso quedó al descubierto que la cláusula de datos del contrato citaba la **Ley 19.628**, derogada
  > por la 21.719, y no traía finalidad, plazo, canal de derechos ni referencia a la política.

- **AC2**: Given cualquier usuario, When navega a **`/politica-privacidad/:branchSlug`** (ruta pública,
  fuera del shell autenticado), Then se renderiza la política de **la sociedad correspondiente a esa
  sede**, con su razón social, RUT, domicilio, correo del canal y fecha de última actualización, sin
  requerir sesión. And los enlaces de los AC1 y AC3 apuntan a la política de la sede en que el alumno se
  está matriculando, no a una genérica.

- **AC3**: Given un alumno en el paso de contrato (`public-contract` o `matricula-steps/contract`),
  When llega al bloque de aceptación, Then ve **dos casillas separadas y ninguna premarcada**: (a) los
  términos del contrato de matrícula, que ya existía, y (b) la declaración de haber leído la política de
  privacidad. And no puede avanzar sin ambas.

- **AC4**: Given una secretaria subiendo un documento al **DMS del alumno**, When el tipo seleccionado es
  `certificado_medico`, Then la subida está bloqueada mientras no marque una casilla de **autorización
  expresa del Art. 16**, específica para ese dato y separada de toda otra aceptación. And esa casilla no
  condiciona la subida de ningún otro tipo de documento.

  > ⚠️ **Corregido el 2026-08-17.** El AC original ubicaba esta casilla en el paso de documentos del
  > wizard de matrícula. Discovery mostró que **el certificado médico no se sube en ningún flujo de
  > matrícula**: `DocumentType` (`core/models/ui/enrollment-documents.model.ts:21-25`) solo tiene
  > `hoja_vida_conductor`, `cedula_identidad`, `licencia_conducir` y `autorizacion_notarial`, y el paso
  > público solo sube `id_photo`. El dueño confirmó el mismo día que **el certificado médico nunca se
  > pide en matrícula — se recibe solo cuando un alumno quiere justificar inasistencias**, y entra por
  > `dms-upload-drawer.component.ts:331`. El gate va donde el dato de salud realmente ingresa.

- **AC5**: Given un alumno que completa cualquiera de los flujos, When se persiste la matrícula, Then
  queda **un registro por cada consentimiento otorgado** con: titular, tipo de consentimiento, si fue
  concedido, fecha y hora, **dirección IP**, **versión de la política vigente** y origen
  (`public` / `secretaria`).

- **AC6**: Given un administrador, When consulta los consentimientos de un alumno, Then puede ver
  qué aceptó, cuándo y con qué versión de política. And ningún rol puede **modificar ni borrar** un
  registro de consentimiento ya otorgado (append-only; solo se admite marcar revocación).

- **AC7**: Given un **alumno menor de edad**, When avanza por el flujo de matrícula, Then el registro
  del consentimiento queda marcado como **otorgado por su representante legal**
  (`granted_by_representative = true`), sin dejar de tener al alumno como titular. And ningún
  consentimiento de un menor queda sin registrar por la rama `@if (!data().isMinor)` que hoy oculta el
  bloque de aceptación.

  > ⚠️ **Ajustado el 2026-08-17.** El AC original pedía identificar al representante **con nombre y
  > RUT**. Se descartó: la **autorización notarial** ya es obligatoria para menores
  > (`MINOR_DOCUMENT`, `required: true` en `enrollment-documents.facade.ts:21`), está firmada ante
  > notario y lo identifica mejor que dos campos tipeados en un formulario. Pedir además su RUT sería
  > recolectar el dato personal de un tercero ya acreditado por otra vía — lo contrario del principio
  > de minimización. Basta el booleano que deja constancia de que **no consintió el menor**.

### Edge cases obligatorios

- **AC-E1**: Given un alumno que entrega un certificado médico para justificar una inasistencia pero
  **no autoriza** su tratamiento digital, When la secretaria intenta cargarlo, Then el archivo **no se
  digitaliza**, queda registrada la negativa (`granted = false`) y la justificación se resuelve con el
  documento físico en el expediente. And la matrícula y la asistencia del alumno no se ven afectadas.

  > ⚠️ **Reformulado el 2026-08-17**, junto con AC4. La redacción original ("la matrícula se puede
  > concretar igual") suponía que el certificado médico era un requisito de matrícula; nunca lo fue.

- ~~**AC-E2**~~ — **ELIMINADO el 2026-08-17.** Describía un flujo que no existe: el dueño confirmó que
  **nunca** se digita al sistema una matrícula tomada en ficha física. En consecuencia se quitó también
  el valor `'papel'` de `consents.source`, que habría quedado como rama muerta. El certificado médico,
  aunque llegue en papel, lo sube la secretaria **desde el sistema** → `source = 'secretaria'`.

- **AC-E3**: Given un alumno que **revoca** un consentimiento revocable, When se procesa la solicitud,
  Then se marca la revocación con su fecha **sin borrar el registro original** del consentimiento
  otorgado.

- **AC-E4**: Given que la **política de privacidad se actualiza** a una versión nueva, When un alumno
  nuevo consiente, Then su registro guarda la versión nueva. And los consentimientos previos conservan
  la versión que estaba vigente cuando se otorgaron.

---

## 4. Out of scope

> Explícito. Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ **Casilla de consentimiento de marketing.** Ambas sociedades declararon (16-08-2026) que **no envían
  correos promocionales**. Pedir un consentimiento que no se usa contradice el principio de minimización.
  El texto quedó guardado en `.compliance/docs/*/21719-consentimiento.md` §2 por si algún día cambia.
- ❌ **MFA / segundo factor.** Riesgo aceptado con fundamento y controles compensatorios. Ver §4.1 de las
  EIPD en `.compliance/docs/*/21719-eipd.md`.
- ❌ **Rutina de depuración a los 5 años.** El primer vencimiento posible está a 5 años del primer egreso
  posterior al despliegue. Se deja definida en el RAT, no construida.
- ❌ **Flujo automatizado de derechos ARCO** (acceso, portabilidad, supresión). Al volumen de estas
  escuelas, los 30 días se cumplen manualmente con el procedimiento de
  `.compliance/docs/*/21719-canal-derechos.md`. La ley no exige automatizarlo.
- ❌ **Anonimización de encuestas de satisfacción.**
- ❌ Publicación de la política en el **sitio web externo**. Se decidió ruta dentro de la app.

---

## 5. Dependencias

### Specs previas
- Ninguna.

### Capacidades del proyecto que se asumen existentes
- `AuthFacade` con `currentUser()`.
- Tabla `audit_log` con captura de `ip` — **se reutiliza el mismo mecanismo** para el `ip` del
  consentimiento, no se inventa uno nuevo.
- Flujo público de inscripción (`/inscripcion`) con RLS para rol anónimo.
- Flujo de matrícula de secretaría (`matricula-steps/`).
- `student_documents` con `type = 'certificado_medico'`.
- `students.is_minor` y `students.has_notarial_auth`.

### Capacidades nuevas requeridas
- Tabla `consents` nueva, con RLS.
- `ConsentsFacade` nuevo.
- Ruta pública `/politica-privacidad/:branchSlug` fuera del shell autenticado, con una política por
  sociedad (ver §9). Reutiliza `branches.slug` y la policy `select_branches_anon` ya existentes.

---

## 6. Datos y modelo (preliminar)

**Tabla nueva `consents`** (detalle final en `plan.md`):

| Columna | Notas |
|---|---|
| `id` | PK |
| `user_id` | FK → `users.id`, nullable (leads sin cuenta) |
| `enrollment_id` | FK → `enrollments.id`, nullable |
| `consent_type` | `matricula_datos` / `certificado_medico` / `preinscripcion` / `marketing` (reservado) |
| `granted` | boolean — se registra también la **negativa** (AC-E1) |
| `granted_at` | timestamptz |
| `revoked_at` | timestamptz nullable — único campo actualizable |
| `ip` | text |
| `policy_version` | text |
| `source` | `public` / `secretaria` — sin `papel` (ver AC-E2) |
| `granted_by_representative` | Booleano: el consentimiento lo otorgó el representante legal de un menor (AC7). **No** se guardan su nombre ni su RUT |

**RLS:** INSERT desde `anon` (flujo público) y `authenticated`; SELECT restringido a `admin` y
`secretary`. **Sin policy de UPDATE salvo `revoked_at`, sin policy de DELETE** — append-only, mismo
criterio que `audit_log` (AC6).

**Modelo UI nuevo:** `core/models/ui/consent.model.ts`.

**Facade nuevo:** `core/facades/consents.facade.ts`. Va como Facade propio y no dentro de
`EnrollmentFacade` porque lo consumen los dos flujos de matrícula y, más adelante, el canal de derechos
para registrar revocaciones.

---

## 7. UX y flujos (preliminar)

**Pantallas afectadas (todas existentes, salvo una):**

| Pantalla | Cambio |
|---|---|
| `public-enrollment-steps/public-personal-data/` | Aviso Art. 14 ter |
| `public-enrollment-steps/public-contract/` (`:107`) | Separar en 2 casillas |
| `matricula-steps/personal-data/` | Aviso Art. 14 ter |
| `matricula-steps/contract/` (`.html:314`) | Separar en 2 casillas |
| `admin/documentos/dms-upload-drawer/` (`:331`) | Casilla Art. 16 que bloquea la subida cuando el tipo es `certificado_medico` — **único punto real de ingreso del dato de salud** (ver AC4) |
| **`/politica-privacidad/:branchSlug`** | **Vista nueva** — única de la spec. Pública, fuera del shell. Una política por sociedad, resuelta por `branches.slug` (ver §9) |

**Flujo principal:** el alumno ve el aviso al entregar sus datos → marca las dos casillas en el contrato
→ marca la del Art. 16 al subir el certificado médico → al confirmar la matrícula se persiste un registro
por cada consentimiento.

**Estados especiales:** si no marca el Art. 16, la subida del certificado queda deshabilitada con un
mensaje que explica por qué (no un error silencioso).

**Fuente de los textos:** están redactados y listos en
`.compliance/docs/conductores/21719-consentimiento.md` y `.compliance/docs/otec/21719-consentimiento.md`.
**No redactar textos nuevos** — usar esos, que son los que respaldan los documentos legales.

> ⚠️ **La "trampa" de la auditoría no existe, y AC7 vive solo en el flujo de secretaría.**
>
> La auditoría advertía que en `public-contract.component.ts` el bloque de aceptación está dentro de
> `@if (!data().isMinor)`, y que replicar ese patrón dejaría sin registro justo a los titulares con más
> protección legal. **Verificado el 2026-08-17: en el flujo público `isMinor` nunca puede ser `true` en
> ese componente.** `canAdvanceFn` (`public-personal-data.component.ts:38-40`) bloquea el avance cuando
> `getAgeStatus()` devuelve `'requires-authorization'` — el caso de 17 años (`age.utils.ts:32`) — y el
> paso 1 muestra *"Tienes 17 años — No puedes inscribirte online"* con los pasos presenciales. Un menor
> **nunca llega al contrato en línea**. Esa rama `isMinor` es código inalcanzable (se deja anotada; no
> se borra, excede esta spec).
>
> **Consecuencia:** AC7 se cumple **únicamente en el flujo de secretaría**, que es donde el apoderado
> está físicamente presente con la autorización notarial. Ahí la casilla la marca la secretaria con él
> al lado y se registra `granted_by_representative = true`. En `public-contract` las dos casillas del
> AC3 van **sin condicional de edad**.

---

## 8. Métricas de éxito post-launch

- **100% de las matrículas** posteriores al despliegue tienen al menos un registro en `consents`. Sin
  excepciones: una matrícula sin consentimiento es un incidente, no una estadística.
- Cero certificados médicos en `student_documents` sin su consentimiento `certificado_medico` asociado.

---

## 9. Notas / decisiones abiertas

- [x] **¿Una política o dos?** → **DOS, una por sociedad.** Resuelto el 2026-08-16 verificando el seed
      (`supabase/migrations/20260301000010_09b_seed_data.sql:21-24`): existen exactamente dos sedes y
      mapean 1:1 con los dos RUT.

      | `branches.slug` | Sociedad | RUT | Canal de derechos |
      |---|---|---|---|
      | `conductores-chillan` | Sociedad Comercial Chillán Capacita Ltda. | 77.940.120-0 | conductorchillan@gmail.com |
      | `autoescuela-chillan` | Jorge Enrique Pérez Godoy Capacitación y Servicios EIRL | 76.007.217-6 | otecchillan@gmail.com |

      Fundamento legal: la política es la declaración de **un responsable identificado** sobre **su**
      tratamiento. No son corresponsables y responden por separado ante la Agencia. Además, la OTEC tiene
      tratamientos propios (datos laborales, informes al empleador, rendición a SENCE) que no aplican al
      alumno de la escuela de conductores.

      La ruta usa el `slug`, que ya existe, es único y es legible por rol anónimo
      (`select_branches_anon`), así que no hace falta esquema nuevo.

- [x] ⚠️ **Corregir el seed de `branches` con los datos reales.** → **Sí, y va antes de exponer la ruta
      pública.** Hoy trae placeholders (`'Dirección Autoescuela Chillán'`,
      `contacto@autoescuela-chillan.cl`) y **la política muestra el domicilio y el correo del
      responsable**, así que publicarla con esos valores sería entregar información falsa al titular.
      Valores reales: Carrera 74 / conductorchillan@gmail.com y Maipón 418 / otecchillan@gmail.com
      (ambos en Chillán, Región de Ñuble). No es solo cosmético: `branches.address` ya se muestra en el
      banner de contexto del flujo público. Migración planificada en `plan.md` §4.
- [x] **Mecanismo de la `ip`** → **no existe ninguno que reutilizar.** `audit_log.ip` es una columna
      declarada que **nada escribe nunca** (ninguna versión de `log_change()` la asigna), y
      `digital_contracts.signature_ip` está igual. Hay que construirlo, por dos caminos distintos:
      **(a) flujo público** → `getClientIp(req)`, que **ya existe** en
      `supabase/functions/public-enrollment/index.ts:260` (hoy lo usa el rate-limit);
      **(b) flujo autenticado** → función Postgres que lee
      `current_setting('request.headers')->>'x-forwarded-for'`, mismo patrón que el trigger de
      auditoría (`20260801140000_audit_log_restore_header_user_id.sql:74`). Resuelto 2026-08-17.
- [x] **Versionado de `policy_version`** → **constante en código**
      (`PRIVACY_POLICY_VERSION` en `core/models/ui/privacy-policy.model.ts`), no tabla. AC-E4 solo exige
      que el registro guarde el string vigente al otorgarse; una tabla agregaría RLS, seed y facade para
      un dato que cambia una vez por década, y la constante además queda versionada en git.
- [x] **¿`consents.branch_id` propio?** → **Sí, `NOT NULL`.** Determina **ante qué responsable** se
      otorgó el consentimiento, y los leads de preinscripción no tienen `enrollment_id` del que
      derivarlo. Sin él, un registro de preinscripción no sabría a cuál de las dos sociedades pertenece
      — que es justo lo que hay que acreditar ante la Agencia.

---

## Changelog

- 2026-08-16 — draft inicial por Matías. Origen: auditoría `.compliance/` corrida 1 (skill
  `compliance-cl`, pack `ley-21719`).
- 2026-08-17 (2) — Decisiones del dueño aplicadas: **AC-E2 eliminado** (nunca hay matrícula en papel) y
  **AC7 ajustado** (el representante se marca con un booleano; su identidad consta en la autorización
  notarial, no se recolecta de nuevo). Confirmado que la preinscripción pública lleva casilla propia.
- 2026-08-17 — Discovery para `plan.md`: **AC4 reubicado al DMS** y **AC-E1 reformulado** (el
  certificado médico nunca se pide en matrícula — confirmado por el dueño; solo entra para justificar
  inasistencias). Cerradas las 4 decisiones abiertas de §9. Actualizada la tabla de §7.
