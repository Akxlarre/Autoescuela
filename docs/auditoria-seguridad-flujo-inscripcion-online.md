# Auditoría de Seguridad — Flujo de Inscripción Online Público (`/inscripcion`)

> **Artefacto de trabajo (Fase 1 — read-only)** — Threat model + hallazgos de seguridad/funcional del flujo público de matrícula.
> Fecha: 2026-06-03 · Auditor: Claude (Opus 4.8) · Método: revisión de código (Edge Function, RLS, facade, frontend)
> Complementa el UX audit en [`auditoria-flujo-inscripcion-online.md`](./auditoria-flujo-inscripcion-online.md)
> **Contexto de riesgo:** producción con dinero real y PII real (RUT, foto carnet) en **semanas** → rigor máximo.

---

## 1. Alcance y superficie de ataque

Flujo **público y anónimo** (sin login). Dos rutas Angular (`/inscripcion`, `/inscripcion/retorno`) que hablan con una sola Edge Function `public-enrollment` que usa `SERVICE_ROLE_KEY` (bypasea RLS).

### Puntos de entrada (acciones de la Edge Function)

| Acción | Tipo | Escribe en BD | Efecto externo |
|--------|------|---------------|----------------|
| `load-instructors` | lectura | — | — |
| `load-schedule` | lectura | — | — |
| `reserve-slots` | mutación | `slot_holds` | — |
| `release-slots` | mutación | `slot_holds` | — |
| `get-carnet-upload-url` | mutación | Storage signed URL | — |
| `generate-contract-preview` | mutación | Storage (PDF) | — |
| `submit-pre-inscription` | **mutación PII** | `users`, `professional_pre_registrations` | — |
| `submit-clase-b` | **mutación PII** | `users`, `students`, `enrollments`, `class_b_sessions` | **envía email** (invite) |
| `initiate-payment` | **mutación PII + $** | `users`, `students`, `enrollments`, `payment_attempts` | **llama Transbank** |
| `confirm-payment` | **mutación $** | `enrollments`, `payments`, `class_b_sessions` | **commit Transbank + email** |

### Acceso anónimo directo (sin pasar por la EF)

- `branches` → `SELECT TO anon USING (true)` — anon lee **todas las columnas de todas las sedes**.
- `courses` → `SELECT TO anon` solo activos no-convalidación.
- `slot_holds`, `payment_attempts` → RLS activo **sin políticas** → solo service role. ✅ Bien.

---

## 2. Lo que YA está bien defendido (no rehacer)

El backend es maduro. Antes de listar huecos, lo que ya está correcto:

- ✅ **Precio server-side** — `initiate-payment` calcula `serverAmount` desde `course.base_price`; el cliente no puede manipular el monto (defiende contra tampering de precio).
- ✅ **Validación server-side** de RUT (`/^\d{7,8}-[\dkK]$/`) y email — defense in depth.
- ✅ **Path traversal** — `moveCarnetPhoto` valida prefijo + token regex + `decodeURIComponent` (defiende variantes `%2e%2e`/`%2f`). OWASP A01.
- ✅ **Anti-DoS de agenda** — `MAX_SLOT_HOLDS_PER_SESSION = 20` rechaza requests que intenten bloquear toda la agenda.
- ✅ **Idempotencia** — `payment_attempts.session_token UNIQUE` + chequeos de estado evitan matrículas/pagos duplicados.
- ✅ **Signed upload URLs** (TTL 5 min) en vez de RLS anon amplia sobre Storage.
- ✅ **Slot holds con TTL** (20 min) + verificación de colisiones → evita doble-booking.
- ✅ **Webpay commit validado** — `response_code === 0 && status === 'AUTHORIZED'` antes de activar; rollback (cancel enrollment + libera holds) si rechaza.
- ✅ **Sesiones creadas solo post-commit** — evita `class_b_sessions` huérfanas si el usuario abandona Transbank.

---

## 3. Hallazgos

> Severidad: 🔴 Alto · 🟠 Medio · 🟡 Bajo. El alcance acordado (audit-first) fija como ACs del spec **solo Altos** (+ S6 por costo bajo/impacto financiero); Medios/Bajos → backlog de follow-up.

### 🔴 S1 — Sin rate-limiting ni CAPTCHA en endpoints públicos de mutación
- **OWASP** A04 (Insecure Design) / A05 · **CWE-770/799**
- **Dónde:** `public-enrollment/index.ts` — todas las acciones de mutación
- **Descripción:** La función es invocable por cualquiera con la anon key (pública por diseño). No hay rate-limiting ni prueba de humanidad. Un atacante puede automatizar `submit-clase-b` / `initiate-payment` / `submit-pre-inscription` para:
  - Crear usuarios/students/enrollments/pre-registros masivos con PII basura (contaminación de BD, ruido para secretarías).
  - **Email-bombing / spam relay vía tu dominio** — cada `submit-clase-b` confirmado dispara `inviteStudentToAuth` → correo de invitación Supabase Auth a un email arbitrario del request. Un atacante puede usar tu proyecto para enviar correos a terceros.
  - Generar transacciones Webpay basura (costo/ruido en el comercio Transbank).
- **Impacto:** Alto — abuso del dominio para spam, contaminación de datos, posible reputación de envío.
- **Fix decidido (cero dependencias externas):**
  1. **Honeypot** — campo oculto en los formularios de mutación; la EF rechaza el request si llega con valor (bots lo llenan, humanos no). Opcional: trampa de velocidad (timestamp server-issued → rechazar submits implausiblemente rápidos).
  2. **Rate-limiting server-side por IP** — tabla Postgres `public_enrollment_throttle` con ventana deslizante; la EF lee `x-forwarded-for`/`x-real-ip`, cuenta intentos por `(ip, action)` y rechaza sobre el umbral (`429`). Sin proveedor de CAPTCHA externo — solo Postgres + headers.

### 🔴 S2 — CORS abierto (`Access-Control-Allow-Origin: '*'`) en acciones de mutación
- **OWASP** A05 (Security Misconfiguration)
- **Dónde:** `index.ts:35`
- **Descripción:** `'*'` permite que cualquier sitio web invoque la función desde el navegador de una víctima. Combinado con S1 (sin gate real), habilita abuso cross-origin de las acciones que envían email / inician pagos.
- **Impacto:** Alto — amplía la superficie de S1.
- **Fix propuesto:** Allowlist de orígenes (las 2 landings Astro + dominio de la app); reflejar `Origin` solo si está en la lista; rechazar el resto.

### 🔴 S3 — Posible secuestro de invitación / pre-takeover de cuenta por email
- **OWASP** A07 (Identification & Authentication Failures)
- **Dónde:** `index.ts:1233` `inviteStudentToAuth(supabase, userId, personalData.email)`
- **Descripción:** El invite se envía al **email del request**, no al email almacenado del usuario. `findOrCreateUser` matchea usuarios existentes por **RUT** (los RUT chilenos son de baja entropía / semi-públicos). Si un RUT ya existe con `first_login=true` (alumno que aún no hizo onboarding), un atacante que conozca ese RUT puede:
  1. Enviar `submit-clase-b` con ese RUT + un email controlado por él.
  2. Recibir el invite de Auth y potencialmente vincular `supabase_uid` a la cuenta de esa persona real antes de que ella onboardee.
- **Impacto:** Alto — apropiación de cuenta de un alumno real.
- **Fix propuesto:** Invitar **solo** al email almacenado en `users` para registros existentes (ignorar el email del request si el RUT ya existe); no vincular `supabase_uid` con datos no verificados; considerar verificación de email antes de cualquier vínculo de identidad.

### 🔴 S4 — PII en logs (RUT, email, datos personales)
- **Compliance** Ley 19.628 (datos personales, Chile) · **OWASP** A09 (Logging Failures)
- **Dónde:** `index.ts:677` y varios `console.log` con `personalData?.rut`, snapshots
- **Descripción:** Los logs de Edge Functions se retienen. Loguear RUT/email en claro es exposición de PII.
- **Impacto:** Alto en contexto de producción inminente con datos reales.
- **Fix propuesto:** Redactar PII de logs — loguear IDs internos o hashes, nunca RUT/email/nombre en claro. Auditar todos los `console.log`/`console.error`.

### 🔴 S5 — Fallback de token débil gatea acceso a foto de carnet (IDOR latente sobre PII sensible)
- **OWASP** A01 (Broken Access Control) · **CWE-330** (Insufficiently Random Values)
- **Dónde:** `public-enrollment.facade.ts:1519` `generateToken()` fallback `${Date.now()}-${Math.random()...}`
- **Descripción:** El acceso a la foto del carnet (`get-carnet-upload-url` / preview) se gatea **solo** por `sessionToken` (path `public-uploads/carnet/{token}`). El fallback no es criptográficamente seguro (predecible). Aunque rara vez se dispara (browsers modernos tienen `crypto.randomUUID`), si lo hace, un token adivinable permite a un atacante pedir signed URL de la foto de carnet (ID nacional) de otra sesión.
- **Impacto:** Alto (PII sensible: documento de identidad) aunque baja probabilidad. Fix barato → vale hacerlo ya.
- **Fix propuesto:** Eliminar el fallback (lanzar error si no hay `crypto.randomUUID`), o bindear el acceso al carnet a un secreto server-side adicional, no solo al token del cliente.

### 🟠 S6 — `confirm-payment` no reconcilia el monto cobrado con el esperado
- **CWE-840** (Business Logic Errors)
- **Dónde:** `index.ts:924` (post-commit) — usa `snapshot.amount` sin comparar contra `commitResponse.amount`
- **Descripción:** Tras el commit de Webpay no se verifica que `commitResponse.amount` coincida con el `serverAmount` esperado (derivado de `base_price`). Defense-in-depth financiera ausente.
- **Impacto:** Medio — Transbank ya valida el monto que creó, pero la reconciliación explícita protege contra discrepancias/manipulación de transacción.
- **Fix propuesto:** Comparar `commitResponse.amount` con el monto esperado del enrollment antes de registrar el `payment`; si difiere → marcar `failed` y alertar. *(Incluido en el spec por costo bajo / impacto financiero.)*

### 🟠 S7 — `@ts-nocheck` desactiva el chequeo de tipos en toda la lógica financiera
- **Dónde:** `index.ts:26`
- **Impacto:** Medio — bugs sutiles en cálculo de montos/estados no se detectan en build.
- **Fix:** Quitar `@ts-nocheck`, tipar (`any` → tipos reales), corregir errores. *(Follow-up — esfuerzo mayor.)*

### 🟠 S8 — Validación server-side incompleta (phone, birthDate, address, gender, courseType)
- **CWE-20** (Improper Input Validation)
- **Dónde:** `findOrCreateUser` / `findOrCreateStudent` / `submit-pre-inscription`
- **Descripción:** Solo se validan RUT/email/nombres. `birthDate` no se valida (fecha futura, edad imposible); `courseType` no se valida contra un enum; phone/address/gender entran sin sanitizar.
- **Impacto:** Medio — datos corruptos, lógica `is_minor` errónea.
- **Fix:** Validar todos los campos server-side (enum de `courseType`, rango de `birthDate`, formato de phone). *(Follow-up.)*

### 🟡 S9 — `branches` expone todas las columnas a anon
- **Dónde:** `20260314100000_public_enrollment_anon_rls.sql` — `USING (true)`
- **Descripción:** Anon lee toda la tabla `branches`. **A verificar:** ¿tiene columnas internas (notas, configuración, datos sensibles)?
- **Fix:** Exponer solo columnas necesarias vía vista pública o restricción de columnas. *(Follow-up — verificar columnas primero.)*

### 🟡 S10 — Función `public-enrollment` no declarada en `config.toml`
- **Dónde:** `supabase/config.toml` (solo `generate-contract-pdf` y `generate-class-book-pdf` declaran `verify_jwt`)
- **Descripción:** El gate de auth de la función es implícito. Hacerlo explícito mejora claridad y evita sorpresas en deploy.
- **Fix:** Declarar `[functions.public-enrollment]` con la política de JWT explícita. *(Follow-up.)*

### 🟡 S11 — `selectedSlotIds` no se re-valida como disponibilidad real en confirm
- **Dónde:** `confirm-payment` inserta `class_b_sessions` desde `snapshot.selectedSlotIds` sin re-verificar disponibilidad
- **Descripción:** Confía en el snapshot. Los holds mitigan, pero un snapshot manipulado en `initiate-payment` podría insertar slots arbitrarios.
- **Fix:** Re-validar que los slots pertenecen a la disponibilidad real del instructor antes de crear sesiones. *(Follow-up.)*

---

## 4. Propuesta de ACs para el Spec A (solo Altos + S6)

| AC | Hallazgo | Criterio de aceptación | Test de regresión |
|----|----------|------------------------|-------------------|
| AC1 | S1 | Honeypot con valor → request rechazado; superar umbral de requests/ventana por IP → rechazo (`429`). Rate-limit server-side, **cero deps externas** | Unit EF: honeypot lleno → rechazo; exceder umbral → rechazo |
| AC2 | S2 | CORS responde el origen solo si está en allowlist; orígenes desconocidos rechazados | Unit EF: Origin no permitido → sin ACAO |
| AC3 | S3 | Para RUT existente, el invite usa el email almacenado, no el del request; no se vincula `supabase_uid` con datos no verificados | Unit EF: submit con RUT existente + email distinto → no invita al email del request |
| AC4 | S4 | Ningún `console.*` emite RUT/email/nombre en claro | Grep/lint: 0 PII en logs |
| AC5 | S5 | `generateToken` no tiene fallback inseguro; sin `crypto.randomUUID` lanza error | Unit facade: fallback eliminado |
| AC6 | S6 | `confirm-payment` verifica `commitResponse.amount === expected`; si difiere → `failed` | Unit EF: amount mismatch → rechazo |
| AC-F1 | Funcional | E2E Playwright: pago **aprobado** (`4051…6623`) → enrollment `active`, número asignado, slots liberados, `/retorno` success | Playwright |
| AC-F2 | Funcional | E2E Playwright: pago **rechazado** (`5186…0568`) → enrollment `cancelled`, holds liberados, `/retorno` rejected | Playwright |

**Out-of-scope del Spec A (backlog):** S7, S8, S9, S10, S11.

---

## 5. Plan de verificación funcional E2E (Transbank integración)

Tarjetas de prueba (entorno integración, ya en la EF):
- **Aprobada:** VISA `4051 8856 0044 6623` · CVV `123` · RUT `11.111.111-1` · clave `123`
- **Rechazada:** MasterCard `5186 0595 5959 0568`

Recorrido Playwright (ambas sedes):
1. `?branchId=1` → completar wizard hasta `payment` (datos válidos, instructor, slots, foto, contrato).
2. `initiate-payment` → redirección a Webpay integración → ingresar tarjeta.
3. Retorno `/inscripcion/retorno?token_ws=…` → verificar estado y efectos en BD (`enrollments.status`, `payments`, `slot_holds` vacío).

---

## 6. Notas de metodología

- Auditoría **read-only**; ningún archivo de producción modificado en esta fase.
- Basada en lectura directa de: `public-enrollment/index.ts` (completo), `20260314…anon_rls.sql`, `20260317…slot_holds.sql`, `public-enrollment.facade.ts` (token gen), `config.toml`.
- Pendiente de verificar in situ: columnas de `branches` (S9), política JWT efectiva en deploy (S10).
