# Spec 0010-b — Hardening de Seguridad del Flujo de Inscripción Online Público

> **Status:** done
> **Created:** 2026-06-03
> **Owner:** Akxlarre
> **Priority:** P0 (bloquea producción — el flujo maneja dinero real y PII en semanas)

---

## 1. Contexto de negocio

**Origen:** Auditoría de seguridad fase 1 (read-only) — [`docs/auditoria-seguridad-flujo-inscripcion-online.md`](../../docs/auditoria-seguridad-flujo-inscripcion-online.md). Fase 2 = remediación de hallazgos Altos.

**Persona afectada:** Alumno público (anónimo) + el negocio (reputación de dominio, integridad de datos y financiera).

**Problema que resuelve:**
El flujo `/inscripcion` es público y anónimo, invocable por cualquiera con la anon key (pública por diseño). Hoy no tiene protección anti-abuso: un atacante puede usar `submit-clase-b` para enviar correos a terceros vía el dominio (spam relay), contaminar la BD con PII basura, o pre-secuestrar cuentas de alumnos reales por RUT. Además hay PII (RUT/email) en logs (Ley 19.628) y un fallback de token débil que gatea el acceso a fotos de carnet. Con producción en semanas, estos huecos bloquean el launch.

**Hipótesis de valor:**
Un flujo público endurecido permite recibir pagos y PII reales sin exponer al negocio a abuso, spam, fraude de identidad o incumplimiento de la ley de datos personales.

---

## 2. User Stories

- **US1**: Como **dueño del negocio**, quiero que el endpoint público resista abuso automatizado (bots/scripts) para que no se use mi dominio como relay de spam ni se contamine la BD.
- **US2**: Como **alumno real**, quiero que nadie pueda apropiarse de mi cuenta conociendo mi RUT para que mi identidad esté protegida.
- **US3**: Como **responsable de cumplimiento**, quiero que no se registre PII en claro en logs para cumplir la Ley 19.628.
- **US4**: Como **equipo de finanzas**, quiero que el monto cobrado se reconcilie con el esperado para garantizar integridad financiera.
- **US5**: Como **equipo**, quiero verificación funcional end-to-end del pago (aprobado y rechazado) para tener certeza de que el flujo funciona antes del launch.

---

## 3. Acceptance Criteria (Gherkin)

> Derivados de la sección 4 del doc de auditoría. Alcance: hallazgos **Altos** (S1–S5) + **S6** (incluido por costo bajo / impacto financiero) + verificación funcional E2E.

- **AC1 (S1 — anti-abuso, cero deps)**: Given una acción de mutación de la Edge Function, When el request llega con el campo honeypot lleno **o** excede el umbral de requests por ventana para su `(ip, action)`, Then la función rechaza el request (honeypot → rechazo; rate-limit → `429`) sin tocar la BD. *(Implementación: honeypot + tabla `public_enrollment_throttle`, sin proveedor CAPTCHA externo.)*

- **AC2 (S2 — CORS allowlist)**: Given un request con header `Origin`, When el origen no está en la allowlist (landings Astro + dominio de la app), Then la respuesta no incluye `Access-Control-Allow-Origin` para ese origen y la acción de mutación se rechaza.

- **AC3 (S3 — invite hardening)**: Given un RUT que ya existe en `users` con `first_login=true`, When se envía `submit-clase-b`/`confirm-payment` con un email distinto al almacenado, Then el invite de Auth se envía **solo** al email almacenado del usuario (no al del request) y `supabase_uid` no se vincula con datos no verificados.

- **AC4 (S4 — PII en logs)**: Given cualquier ejecución de la Edge Function, When se emiten logs, Then ningún `console.*` contiene RUT, email o nombre en claro (solo IDs internos o valores redactados).

- **AC5 (S5 — token sin fallback débil)**: Given un entorno sin `crypto.randomUUID`, When se genera un `sessionToken`, Then la app lanza error explícito en vez de usar un token predecible (`Date.now()-Math.random()`).

- **AC6 (S6 — reconciliación de monto)**: Given un commit de Webpay exitoso, When `commitResponse.amount` difiere del monto esperado del enrollment, Then la función marca el intento como `failed` y NO registra el `payment`.

- **AC-F1 (E2E pago aprobado)**: Given el wizard completo de Clase B con datos válidos, When se paga con la tarjeta de prueba aprobada (`4051 8856 0044 6623`), Then el enrollment queda `active` con número asignado, se registra el `payment`, los `slot_holds` de la sesión se liberan y `/inscripcion/retorno` muestra estado success.

- **AC-F2 (E2E pago rechazado)**: Given el wizard completo de Clase B, When se paga con la tarjeta de prueba rechazada (`5186 0595 5959 0568`), Then el enrollment queda `cancelled`, los `slot_holds` se liberan, no se crea `payment` y `/inscripcion/retorno` muestra estado rejected.

### Edge cases obligatorios

- **AC-E1 (rate-limit no bloquea usuarios legítimos)**: Given un usuario humano que completa el flujo a velocidad normal con honeypot vacío, When envía sus requests dentro del umbral, Then ninguno es rechazado.
- **AC-E2 (ventana de rate-limit se reinicia)**: Given una IP que alcanzó el umbral, When transcurre la ventana de tiempo, Then la IP puede volver a operar.

---

## 4. Out of scope

> Diferidos a follow-up (hallazgos Medios/Bajos del doc de auditoría). NO extender esta spec.

- ❌ **S7** — quitar `@ts-nocheck` y tipar la Edge Function (esfuerzo mayor, follow-up).
- ❌ **S8** — validación server-side completa de phone/birthDate/address/gender/courseType.
- ❌ **S9** — restringir columnas de `branches` expuestas a anon.
- ❌ **S10** — declarar `public-enrollment` explícitamente en `config.toml`.
- ❌ **S11** — re-validar `selectedSlotIds` como disponibilidad real en `confirm-payment`.
- ❌ Rediseño visual / responsivo del wizard (lo cubre el spec siguiente de UI detallista).

---

## 5. Dependencias

### Specs previas
- 0009 (rediseño UX) — done. fix-006 (responsive) — done.

### Capacidades del proyecto que se asumen existentes
- Edge Function `public-enrollment` con todas sus acciones operativas.
- Integración Transbank Webpay Plus (entorno integración) funcionando.
- `PublicEnrollmentFacade` y los componentes del wizard.
- Playwright MCP para verificación E2E.

### Capacidades nuevas requeridas
- Tabla `public_enrollment_throttle` (rate-limiting por IP).
- Campo honeypot en los formularios de mutación del wizard.
- Lista de orígenes permitidos (env var o constante) para CORS.

---

## 6. Datos y modelo (preliminar)

- **Tabla nueva:** `public_enrollment_throttle` — `(ip text, action text, created_at timestamptz)` o contador con ventana; RLS activa sin políticas (solo service role). Índice por `(ip, action, created_at)`. Función de limpieza de filas viejas.
- **Modelos UI:** posible campo honeypot en el payload de `personalData` / submit (no es PII, no se persiste).
- **RLS requerida:** la nueva tabla sigue el patrón de `slot_holds`/`payment_attempts` (RLS on, sin policy → solo EF).

---

## 7. UX y flujos (preliminar)

- **Pantalla(s) afectada(s):** ninguna a nivel visible — el honeypot es un campo oculto; el rate-limit/CORS son server-side. La única UX nueva es el manejo de error si el usuario es rate-limited (mensaje claro, no error críptico).
- **Flujo principal:** sin cambios visibles para el usuario legítimo.
- **Estados especiales:** request rechazado por rate-limit → mensaje "demasiados intentos, espera un momento".

---

## 8. Métricas de éxito post-launch

- 0 incidentes de spam relay vía el dominio.
- 0 PII en logs (auditable por grep).
- Pagos reconciliados al 100% (monto cobrado == esperado).

---

## 9. Notas / decisiones abiertas

- [x] Mecanismo anti-abuso: **rate-limit server-side + honeypot, cero deps externas** (decidido 2026-06-03).
- [x] Verificación E2E: **aprobado + rechazado** con tarjetas Transbank (decidido 2026-06-03).
- [x] Umbral y ventana del rate-limit: **10 requests / 10 minutos por `(ip, action)`** (decidido 2026-06-03).
- [x] Allowlist de orígenes: **env var `PUBLIC_ENROLLMENT_ALLOWED_ORIGINS`** (CSV) — más flexible para el cliente, sin redeploy (decidido 2026-06-03).

---

## Changelog

- 2026-06-03 — draft inicial por Akxlarre (derivado de auditoría de seguridad fase 1).
