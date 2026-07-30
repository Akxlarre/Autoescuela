# Spec 0025-b — Notificaciones Ola 2 (circuito financiero + onboarding)

> **Status:** done
> **Created:** 2026-07-07
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** `indices/NOTIFICATIONS-MAP.md` (mapa de productores, creado en Spec 0024), sección "Priorización acordada" — Ola 2.

**Persona afectada:** Alumno, Instructor, Secretaria/Admin.

**Problema que resuelve:**
Tras Ola 1 (Spec 0024) solo 4 eventos disparan notificaciones persistentes (matrícula, reprogramación, certificado, pre-inscripción). El circuito financiero completo (pagos presenciales, pagos online, anticipos, liquidaciones) y el onboarding de cuentas nuevas siguen sin notificar a nadie — el alumno no recibe comprobante in-app de sus pagos, el instructor no se entera cuando se le registra un anticipo o se le paga una liquidación, y una cuenta de alumno recién activada no recibe bienvenida.

**Hipótesis de valor:**
Cerrar el circuito financiero con notificaciones reduce las consultas manuales ("¿ya me pagaron?", "¿se registró mi abono?") y mejora la percepción de transparencia del portal para alumnos e instructores.

---

## 2. User Stories

- **US1**: Como alumno, quiero recibir una notificación cuando se registra un pago presencial (clase B, curso singular o servicio especial) para tener un comprobante in-app inmediato.
- **US2**: Como alumno, quiero recibir confirmación cuando mi pago online se procesa correctamente.
- **US3**: Como secretaria/admin de la sede, quiero enterarme cuando un alumno paga online para poder conciliar sin revisar manualmente.
- **US4**: Como alumno del curso profesional, quiero recibir una notificación cuando el instructor confirma mis notas, con indicación clara si reprobé algún módulo (< 75).
- **US5**: Como instructor, quiero recibir una notificación cuando se me registra un anticipo.
- **US6**: Como instructor, quiero recibir una notificación cuando se paga mi liquidación.
- **US7**: Como alumno nuevo, quiero recibir una notificación de bienvenida cuando mi cuenta se activa, para saber que ya puedo usar el portal.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no podés escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1 (A4 — Pago presencial)**: Given un alumno con matrícula activa, When se registra un pago presencial vía `EnrollmentPaymentFacade.recordPayment()`, `PagosFacade` (abono), `CursosSingularesFacade.marcarEnrollmentPagado()` o `ServiciosEspecialesFacade.registrarCobro()`, Then el alumno recibe una notificación tipo `payment` con el monto y NO se genera notificación al admin/secretaria.
- **AC2 (B2 — Pago online)**: Given un alumno que completa un pago online, When la Edge Function `student-payment` confirma el cobro, Then el alumno recibe notificación `payment` de confirmación y la secretaria/admin de la sede correspondiente recibe notificación del pago recibido.
- **AC3 (A5 — Notas confirmadas)**: Given un curso profesional con notas cargadas, When el instructor ejecuta `EvaluacionesProfesionalFacade.confirmarNotas()`, Then cada alumno del curso recibe una notificación tipo `professional_session`, con severidad/mensaje distinto si su módulo promedia menos de 75 (reprobado).
- **AC4 (A6 — Anticipo)**: Given un instructor activo, When se registra un anticipo vía `AnticiposFacade`, Then el instructor recibe notificación `payment` con el monto del anticipo.
- **AC5 (A7 — Liquidación pagada)**: Given una liquidación de instructor, When se marca como pagada en `LiquidacionesFacade`, Then el instructor recibe notificación `payment` confirmando el pago de su liquidación.
- **AC6 (B3 — Cuenta activada)**: Given una cuenta de alumno recién creada, When la Edge Function `activate-student-account` completa la activación, Then el alumno recibe una notificación tipo `info` de bienvenida al portal.
- **AC7 (Anti-ruido)**: Given cualquiera de los eventos anteriores, When el actor que ejecuta la acción es también el destinatario potencial, Then no se genera notificación al actor (regla heredada de Ola 1).
- **AC8 (Anti-ruido pagos)**: Given un pago presencial individual (AC1), When se registra, Then el admin NO recibe notificación (el dashboard ya cubre esta métrica vía F-1; evitar duplicar ruido).

### Edge cases obligatorios

- **AC-E1**: Given un pago que se registra con monto $0 o ajuste (nota de crédito), When se dispara el productor, Then no se genera notificación (evitar ruido en correcciones administrativas). **Decidido 2026-07-07.**
- **AC-E2**: Given un curso profesional con múltiples módulos, When se confirman notas y el alumno reprueba más de un módulo, Then el mensaje de la notificación resume el peor caso sin listar cada módulo individualmente.
- **AC-E3**: Given una liquidación con pago parcial (abono), When se registra, Then se notifica igual que un pago completo, indicando que es parcial en el mensaje.
- **AC-E4**: Given B2 (pago online) y B3 (cuenta activada) corren en Edge Functions con `service role`, When se ejecutan, Then deben usar el mismo helper `notifyRole`/patrón establecido en Ola 1 para no duplicar lógica de inserción.

---

## 4. Out of scope

- ❌ Grupo C del mapa (triggers SQL — bloqueado por decisión técnica R1) → Ola 3.
- ❌ D1 (RF-018, vencimientos de pago) → Ola 3.
- ❌ Canales externos (email/WhatsApp, R7) → Ola 4.
- ❌ A8 (documento subido a ficha) y A9 (reasignación de ciclo teórico) — quedaron fuera de la priorización de Ola 2 según el mapa; no se agregan aquí salvo que el usuario los pida explícitamente.
- ❌ Página "ver todas las notificaciones" para admin/secretaria/alumno (pendiente de decisión, mencionado en el mapa como fuera de scope de Ola 1 y no resuelto aún).

---

## 5. Dependencias

### Specs previas
- Spec 0024 (Notificaciones Ola 1) — debe estar `done`. ✅ Ya lo está (cerrada 2026-07-07).

### Capacidades del proyecto que se asumen existentes
- `NotificationsFacade.createNotification()` y el helper `notifyRole()` (creado en Ola 1).
- `NotificationReferenceType` y `mapReferenceToNotificationType()` extensibles (Ola 1).
- RLS de `notifications`: INSERT solo permitido a `admin`/`secretary` desde cliente — los eventos de instructor/alumno (A4, A5, A6, A7) requieren Edge Function o ajuste de policy, igual que en Ola 1.
- Edge Functions existentes `student-payment` y `activate-student-account` (para B2, B3) — confirmar que ya existen y están desplegadas antes de planificar.

### Capacidades nuevas requeridas
- Ninguna — reutiliza el tipo `payment` existente (Ola 1) para los 4 subtipos financieros (A4, A6, A7, B2); el mensaje de texto distingue el contexto.

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas nuevas / modificadas: ninguna prevista — reutiliza `notifications` (Ola 1).
- Modelos UI nuevos: ninguno previsto — reutiliza `NotificationReferenceType`.
- RLS requerida: confirmar si A4/A5/A6/A7 (client-side desde Facades de rol instructor/secretaria) caen dentro de policies existentes o necesitan Edge Function como B1 en Ola 1.

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): panel de notificaciones (campana) en portal alumno, portal instructor y portal secretaria/admin — mismo componente `app-notifications-panel` de Ola 1.
- Flujo principal (happy path): acción de negocio (pago, anticipo, liquidación, notas, activación de cuenta) → productor dispara `createNotification()`/`notifyRole()` → campana se actualiza vía Realtime → usuario hace click → deep-link si aplica (`reference_type='task'` es el único con deep-link hoy; evaluar si `payment`/`professional_session` necesitan uno).
- Estados especiales (loading, error, vacío): reutiliza los ya definidos en el panel (Ola 1) — sin cambios previstos.

---

## 8. Métricas de éxito post-launch

- Reducción de consultas manuales a secretaría sobre estado de pagos (cualitativo, sin instrumentación hoy).
- % de alumnos que abren la notificación de pago dentro de 24h (si se agrega tracking de `read_at`, ya existente en la tabla).

---

## 9. Notas / decisiones abiertas

- [x] ✅ Decidido 2026-07-07: los 6 ítems (A4, A5, A6, A7, B2, B3) se implementan bajo esta única spec (un solo `plan.md`/`tasks.md`), no se subdividen en fixes separados.
- [x] ✅ Decidido 2026-07-07: pagos con monto $0 o notas de crédito/ajuste NO notifican (AC-E1).
- [x] ✅ Decidido 2026-07-07: `payment` usa un único ícono para todos los subtipos (presencial, anticipo, liquidación, online) — el mensaje de texto distingue el contexto. No se extiende `NotificationReferenceType` por esto.
- [x] ✅ Verificado 2026-07-07: `supabase/functions/student-payment/` y `supabase/functions/activate-student-account/` existen como Edge Functions reales en el repo.

---

## Changelog

- 2026-07-07 — draft inicial por Akxlarre, basado en `indices/NOTIFICATIONS-MAP.md` (priorización Ola 2).
- 2026-07-07 — approved. Decisiones abiertas resueltas: spec única (sin subdividir en fixes), pagos $0/nota de crédito no notifican, `payment` sin subtipos visuales. EFs `student-payment` y `activate-student-account` verificadas en el repo.
