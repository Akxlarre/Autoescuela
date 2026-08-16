# Spec 0009-m — Registro de consentimiento y deber de información (Ley 21.719)

> **Status:** draft
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
  enlace a la política de privacidad. Ídem en el paso equivalente del flujo de secretaría.

- **AC2**: Given cualquier usuario, When navega a **`/politica-privacidad/:branchSlug`** (ruta pública,
  fuera del shell autenticado), Then se renderiza la política de **la sociedad correspondiente a esa
  sede**, con su razón social, RUT, domicilio, correo del canal y fecha de última actualización, sin
  requerir sesión. And los enlaces de los AC1 y AC3 apuntan a la política de la sede en que el alumno se
  está matriculando, no a una genérica.

- **AC3**: Given un alumno en el paso de contrato (`public-contract` o `matricula-steps/contract`),
  When llega al bloque de aceptación, Then ve **dos casillas separadas y ninguna premarcada**: (a) los
  términos del contrato de matrícula, que ya existía, y (b) la declaración de haber leído la política de
  privacidad. And no puede avanzar sin ambas.

- **AC4**: Given un alumno en el paso de documentos, When intenta **subir el certificado médico**, Then
  la subida está bloqueada mientras no marque una casilla de **autorización expresa del Art. 16**,
  específica para ese dato y separada de toda otra aceptación. And esa casilla no condiciona la subida de
  los demás documentos.

- **AC5**: Given un alumno que completa cualquiera de los flujos, When se persiste la matrícula, Then
  queda **un registro por cada consentimiento otorgado** con: titular, tipo de consentimiento, si fue
  concedido, fecha y hora, **dirección IP**, **versión de la política vigente** y origen
  (`public` / `secretaria` / `papel`).

- **AC6**: Given un administrador, When consulta los consentimientos de un alumno, Then puede ver
  qué aceptó, cuándo y con qué versión de política. And ningún rol puede **modificar ni borrar** un
  registro de consentimiento ya otorgado (append-only; solo se admite marcar revocación).

- **AC7**: Given un **alumno menor de edad**, When avanza por el flujo de matrícula, Then los
  consentimientos los otorga su **representante legal**, identificado con nombre y RUT, y quedan
  registrados a su nombre en relación con el alumno. And ningún consentimiento de un menor queda sin
  registrar por la rama `@if (!data().isMinor)` que hoy oculta el bloque de aceptación.

### Edge cases obligatorios

- **AC-E1**: Given un alumno que **no marca** la autorización del Art. 16, When completa el resto de la
  matrícula, Then la matrícula se puede concretar igual, pero **sin certificado médico digitalizado** y
  con constancia registrada de que no autorizó.

- **AC-E2**: Given una matrícula tomada **en papel** por secretaría, When la secretaria la carga al
  sistema, Then puede registrar los consentimientos con origen `papel`, quedando trazable que la
  evidencia física está en el expediente.

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
| `source` | `public` / `secretaria` / `papel` |
| `granted_by_representative` | Datos del representante legal cuando el titular es menor (AC7) |

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
| `public-enrollment-steps/public-documents/` | Casilla Art. 16 que bloquea la subida del certificado médico |
| `matricula-steps/personal-data/` | Aviso Art. 14 ter |
| `matricula-steps/contract/` (`.html:314`) | Separar en 2 casillas |
| `matricula-steps/documents/` | Casilla Art. 16 |
| **`/politica-privacidad/:branchSlug`** | **Vista nueva** — única de la spec. Pública, fuera del shell. Una política por sociedad, resuelta por `branches.slug` (ver §9) |

**Flujo principal:** el alumno ve el aviso al entregar sus datos → marca las dos casillas en el contrato
→ marca la del Art. 16 al subir el certificado médico → al confirmar la matrícula se persiste un registro
por cada consentimiento.

**Estados especiales:** si no marca el Art. 16, la subida del certificado queda deshabilitada con un
mensaje que explica por qué (no un error silencioso).

**Fuente de los textos:** están redactados y listos en
`.compliance/docs/conductores/21719-consentimiento.md` y `.compliance/docs/otec/21719-consentimiento.md`.
**No redactar textos nuevos** — usar esos, que son los que respaldan los documentos legales.

> ⚠️ **Trampa detectada en la auditoría:** en `public-contract.component.ts` el bloque de aceptación está
> dentro de `@if (!data().isMinor)`. Si se replica el patrón sin más, **justo los titulares con mayor
> protección legal quedan sin registro de consentimiento**. AC7 existe por esto.

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

- [ ] ⚠️ **Corregir el seed de `branches` con los datos reales.** Hoy trae placeholders
      (`'Dirección Autoescuela Chillán'`, `contacto@autoescuela-chillan.cl`) y **la política muestra el
      domicilio y el correo del responsable**, así que publicarla con esos valores sería entregar
      información falsa al titular. Valores reales: Carrera 74 / conductorchillan@gmail.com y
      Maipón 418 / otecchillan@gmail.com (ambos en Chillán, Región de Ñuble).
- [ ] Confirmar el mecanismo exacto con que `audit_log` obtiene la `ip`, para reutilizarlo tal cual.
- [ ] Definir cómo se versiona `policy_version` (constante en código vs. tabla).
- [ ] Definir si `consents` necesita `branch_id` propio para saber **ante qué responsable** se otorgó cada
      consentimiento, o si basta derivarlo por `enrollment_id`. Importa para los leads de preinscripción,
      que pueden no tener matrícula asociada todavía.

---

## Changelog

- 2026-08-16 — draft inicial por Matías. Origen: auditoría `.compliance/` corrida 1 (skill
  `compliance-cl`, pack `ley-21719`).
