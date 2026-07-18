# Plan 0025-b — Notificaciones Ola 2: circuito financiero + onboarding

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (2026-07-07)
> **Created:** 2026-07-07
> **Talla:** M (por analogía con Spec 0024: 6 productores en 7 facades + 2 EFs existentes, 0 migraciones, 0 facades nuevos, ~9 archivos modificados)

---

## 1. Resumen ejecutivo

Se conectan 6 productores nuevos a la infraestructura de notificaciones que ya existe desde Ola 1 (Spec 0024): 4 client-side en facades de rol admin/secretaria (pago presencial ×3 variantes, notas confirmadas, anticipo, liquidación — todos permitidos por RLS porque el actor es admin/secretaria) y 2 server-side en Edge Functions ya desplegadas (`student-payment` para el pago online del alumno, `activate-student-account` para la bienvenida). **Cero cambios de modelo**: el tipo `payment` y el helper `notifyRole`/`notifyUsers` ya existen y ya están mapeados en el panel (ícono `credit-card`, severidad `info`). Orden grueso: productores client-side más simples primero (Liquidación, Anticipo — resolución de FK mínima) → productores con resolución de FK (pago presencial ×3, notas) → productores EF → QA.

---

## 2. Inventario de impacto

### Archivos a CREAR

Ninguno. Todo es extensión de archivos existentes.

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/facades/anticipos.facade.ts` | En `registrarAnticipo()`, tras el insert exitoso (antes de `refreshSilently()`): resolver `instructors.id → users.id` (helper privado, mismo patrón que `resolveInstructorUserIds` de `admin-alumno-detalle.facade.ts`) y notificar al instructor | AC4 |
| `src/app/core/facades/liquidaciones.facade.ts` | En `registrarPago()`, tras el upsert exitoso: notificar al instructor usando `row.userId` (**ya viene resuelto** en `LiquidacionRow.userId`, sin query extra) | AC5 |
| `src/app/core/facades/enrollment-payment.facade.ts` | En `recordPayment()`, tras el `return true` final: helper `notifyPaymentRegistered(enrollmentId)` — resuelve `enrollments.student_id → students.user_id`, notifica solo al alumno (NO al admin) | AC1, AC8 |
| `src/app/core/facades/pagos.facade.ts` | En `registrarNuevoPago()`, tras el `refreshSilently()`: mismo helper de resolución (duplicado local, es un Facade distinto) — notifica al alumno | AC1, AC8 |
| `src/app/core/facades/cursos-singulares.facade.ts` | En `marcarEnrollmentPagado()`, tras el `return true`: resolver `standalone_course_enrollments.student_id → students.user_id`, notificar al alumno | AC1, AC8 |
| `src/app/core/facades/servicios-especiales.facade.ts` | En `registrarCobro()`, tras el optimistic update: si `special_service_sales.student_id` no es null, resolver `students.user_id` y notificar; si es null (cliente externo, `is_student=false`) no-op | AC1, AC8, AC-E1 (variante: sin destinatario) |
| `src/app/core/facades/evaluaciones-profesional.facade.ts` | En `_persist('confirmed')`, tras el upsert exitoso: helper `notifyGradesConfirmed()` — resuelve en batch `enrollments.id → students.user_id` para todos los `enrollmentId` únicos de `g.filas`, notifica a cada alumno con mensaje distinto si `promedioAprobado === false` | AC3 |
| `supabase/functions/student-payment/index.ts` | En `handleConfirmPayment()`, paso 6 (tras confirmar el pago, antes del `return jsonResponse`): ampliar el SELECT de enrollment con `student_id, branch_id, students!inner(user_id)`; INSERT batch en `notifications` para el alumno (confirmación) + secretarias de la sede + admins, en try/catch propio | AC2, AC-E4 |
| `supabase/functions/activate-student-account/index.ts` | En la rama "primera vez" (`!targetUser.supabase_uid`, antes del `return jsonResponse({ success:true, status:'invited' }, 201)`): INSERT en `notifications` para `targetUser.id`, tipo `info`, mensaje de bienvenida. **NO** en la rama de reenvío (evita notificación duplicada) | AC6 |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Infraestructura de Ola 1 que reutilizamos tal cual
- `NotificationsFacade.notifyUsers()` / `notifyRole()` — sin cambios, ya soportan todo lo que Ola 2 necesita.
- `NotificationReferenceType` — `'payment'` **ya existía antes de Ola 1** (no se agrega). `mapReferenceToNotificationType('payment')` → `'info'` (`notification.utils.ts:23`). Cero cambios de modelo.
- Panel de notificaciones — `iconFor` ya resuelve `payment` → ícono `credit-card` (registrado en `app.config.ts` desde Ola 1, T3.2). Cero cambios de UI.
- Deep-links (`topbar.onNotifClicked()`) — `payment` no tiene ruta asignada; cae al comportamiento default (cierra el panel sin navegar ni error). **Decisión: no se agrega deep-link en Ola 2** — no hay una "página de mi pago" única en el portal alumno a la que enlazar, y agregar uno es scope nuevo, no pedido en los AC.

### Patrones de resolución de destinatarios (copiar, no reinventar)
- **`resolveStudentUserId(studentId)`** (`students.id → users.id`) — patrón ya usado en `certificacion-clase-b.facade.ts:152` y `certificacion-profesional.facade.ts:211`. Se **duplica localmente** en cada facade que lo necesita (mismo criterio que Ola 1: cada Facade es autónomo, sin un util compartido cross-facade — evita acoplar Facades entre sí).
- **`resolveInstructorUserIds(instructorIds[])`** (`instructors.id → users.id`, batch vía Map) — patrón ya usado en `admin-alumno-detalle.facade.ts:1084`. Se duplica en `anticipos.facade.ts` (solo 1 instructor a la vez, pero se mantiene la firma batch por consistencia).
- **`LiquidacionesFacade` NO necesita resolver nada** — `LiquidacionRow.userId` (línea 311 de `liquidaciones.facade.ts`) ya trae `users.id` resuelto desde el `fetchLiquidacionesData()` existente. Es el único productor de Ola 2 sin query adicional.
- **Patrón fire-and-forget**: copiar de Ola 1 — `.catch(() => this.toast.warning(...))`, nunca bloquea ni revierte la mutación principal (AC-E1 heredado de Ola 1, aplicado también en Ola 2 al caso $0/nota de crédito).

### Componentes/Facades que NO existen y NO se crean
- Nada. Ola 2 es 100% conexión de productores — no hay UI nueva, no hay Facade nueva, no hay modelo nuevo.

---

## 4. Modelo de datos

**N/A — sin migraciones.** Se reutiliza `notifications` tal cual quedó tras Ola 1.

### Resolución de destinatario por productor

| Productor | Tabla origen | Camino a `users.id` |
|---|---|---|
| A4a — `EnrollmentPaymentFacade.recordPayment()` | `enrollments` | `enrollments.student_id → students.id → students.user_id` |
| A4b — `PagosFacade.registrarNuevoPago()` (abono) | `enrollments` | ídem |
| A4c — `CursosSingularesFacade.marcarEnrollmentPagado()` | `standalone_course_enrollments` | `standalone_course_enrollments.student_id → students.user_id` |
| A4d — `ServiciosEspecialesFacade.registrarCobro()` | `special_service_sales` | `special_service_sales.student_id` (**nullable** — guard: si es `null`, es venta a cliente externo, no-op) `→ students.user_id` |
| A5 — `EvaluacionesProfesionalFacade.confirmarNotas()` | `enrollments` (uno por fila de `g.filas`) | batch: `enrollments.id IN (...) → students.user_id` |
| A6 — `AnticiposFacade.registrarAnticipo()` | `instructor_advances` | `instructor_advances.instructor_id → instructors.id → instructors.user_id` |
| A7 — `LiquidacionesFacade.registrarPago()` | `instructor_monthly_payments` (via `LiquidacionRow`) | **ya resuelto** en memoria (`row.userId`) |
| B2 — EF `student-payment` | `payment_attempts.enrollment_id → enrollments` | `enrollments.student_id → students.user_id` (alumno) + `enrollments.branch_id` (para `notifyRole('secretary', branchId)` + admins, replicando el patrón de `public-enrollment` de Ola 1) |
| B3 — EF `activate-student-account` | `users` (payload ya trae `userId`) | directo, sin resolver |

### RLS

Sin cambios. Verificado contra `indices/DATABASE.md`:
- `instructor_advances`, `instructor_monthly_payments`, `payments`, `standalone_course_enrollments`, `special_service_sales`, `professional_module_grades` — todos mutados por facades cuyo actor real es `admin`/`secretary` (verificado: `AnticiosFacade` solo se usa en `features/admin/contabilidad-anticipos/`; `EvaluacionesProfesionalFacade` solo en `features/admin/profesional-evaluaciones/` y `features/secretaria/profesional-notas/`). El INSERT en `notifications` cae dentro de la policy `insert_notifications` (`admin`/`secretary`) sin necesidad de EF.
- B2 y B3 usan `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS), igual que B1 en Ola 1.

### Modelos UI/DTO

Ninguno modificado.

---

## 5. Arquitectura del feature

### Flujo productor → consumidor

```
[Productores client-side, actor admin/secretaria]
 AnticiposFacade.registrarAnticipo()          ─┐
 LiquidacionesFacade.registrarPago()           │
 EnrollmentPaymentFacade.recordPayment()       ├─ notifyUsers() ──> INSERT notifications
 PagosFacade.registrarNuevoPago()              │      (fire-and-forget)      │
 CursosSingularesFacade.marcarEnrollmentPagado()│                            │
 ServiciosEspecialesFacade.registrarCobro()     │                            │
 EvaluacionesProfesionalFacade.confirmarNotas()─┘                            │ Realtime
                                                                              │ (recipient_id filter)
[Productores server-side, service role]                                     │
 EF student-payment.handleConfirmPayment() ──────────────────────────────────┤
 EF activate-student-account (rama "invited") ───────────────────────────────┤
                                                                              ▼
                                      NotificationsFacade (signal _notifications + toast)
                                                                              │
                                      panelEntries = groupNotifications(filtered) |> take(15)
                                                                              ▼
                          TopbarComponent ──> <app-notifications-panel [entries]>
                                (sin cambios — payment ya soportado desde Ola 1)
```

### Contenido de cada productor

| Productor | Destinatarios | Subject / message (esqueleto) |
|---|---|---|
| A4a/b/c — Pago presencial / abono | Alumno únicamente | "Pago registrado" / "Se registró un pago de ${monto} en tu matrícula {curso}." |
| A4d — Cobro servicio especial | Alumno (si `student_id` no es null) | "Pago registrado" / "Se registró el cobro de {servicio}." |
| A5 — Notas confirmadas | Cada alumno del curso | Aprobó: "Tus notas fueron confirmadas" / "Promedio final: {promedio}, aprobado." · Reprobó: mismo subject / "Promedio final: {promedio} — no alcanzó el mínimo de aprobación (75)." |
| A6 — Anticipo registrado | Instructor | "Anticipo registrado" / "Se registró un anticipo de ${monto}." |
| A7 — Liquidación pagada | Instructor | "Liquidación pagada" / "Tu liquidación de {mes/año} fue pagada (líquido ${monto})." |
| B2 — Pago online (EF) | Alumno + `notifyRole('secretary', branchId)` + `notifyRole('admin', null)` equivalente (query directa, sin `NotificationsFacade`) | Alumno: "Pago confirmado" / "Tu pago de ${monto} fue confirmado." · Secretaria/admin: "Pago online recibido" / "{alumno} pagó ${monto} — matrícula {número}." |
| B3 — Cuenta activada (EF) | Alumno (solo en invite inicial, no en reenvío) | "Bienvenido al portal" / "Tu cuenta ya está lista. Revisa tu correo para activar tu contraseña." |

**Anti-ruido (heredado de Ola 1, AC7/AC8 de esta spec):**
- A4 nunca notifica al admin/secretaria (decisión explícita del mapa — el dashboard ya cubre esa métrica).
- Pagos $0 / notas de crédito no disparan notificación (AC-E1) — guard `if (amount <= 0) return` antes de notificar en cada productor de pago.
- El actor (quien ejecuta la acción) nunca se auto-notifica vía `notifyRole` — ya lo garantiza `notifyRole()` internamente (`.neq('id', actorDbId)`). Esto **no aplica** a A4/A5/A6/A7/B2 porque el destinatario (alumno/instructor) nunca coincide con el actor (admin/secretaria) — es una notificación cross-rol, no un broadcast que el actor podría auto-recibir.

### Capas tocadas

- **Facades**: `anticipos`, `liquidaciones`, `enrollment-payment`, `pagos`, `cursos-singulares`, `servicios-especiales`, `evaluaciones-profesional` — todos ganan un helper privado de notificación, ninguno cambia su contrato público.
- **Edge Functions**: `student-payment`, `activate-student-account`.
- **Sin cambios**: Dumb components, Smart components, Utils, Modelos.

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — Facade estricto (las notificaciones se insertan desde el Facade, nunca desde el componente); OnPush intacto (no se toca ningún componente)
- [x] `facades.md` — ningún Facade nuevo; los 7 Facades tocados mantienen su estructura de 3 secciones
- [ ] `models.md` — sin cambios de modelo (ni DTO ni UI)
- [x] `visual-system.md` — cero UI nueva; el ícono/severidad de `payment` ya cumple el DS desde Ola 1
- [x] `swr-pattern.md` — los productores usan `refreshSilently()` existente tras la mutación, sin tocar el ciclo SWR
- [x] `notifications.md` — regla madre: todo INSERT pasa por `NotificationsFacade` (client-side) o INSERT directo con service role (EF, igual que B1 en Ola 1); nunca desde un Dumb component
- [x] `testing-tdd.md` — specs primero para cada helper nuevo en los 7 facades (lógica de negocio nueva: resolución de destinatario + guard de monto $0)
- [ ] `ai-readability.md` — no aplica, no hay UI/DOM nuevo

---

## 7. Plan de testing

- **Unitarios (Vitest, TDD) por facade tocado:**
  - `anticipos.facade.spec.ts`: `registrarAnticipo` notifica al instructor correcto (resuelto vía `instructors.user_id`); insert fallido no rompe el registro del anticipo (AC-E1 análogo).
  - `liquidaciones.facade.spec.ts`: `registrarPago` notifica usando `row.userId` sin query extra (assert de que NO se llama a `.from('instructors')` en el mock — confirma que se reutiliza el dato en memoria).
  - `enrollment-payment.facade.spec.ts`: `recordPayment` notifica al alumno, NO llama `notifyRole('admin', ...)`; monto $0 no notifica (AC-E1).
  - `pagos.facade.spec.ts`: `registrarNuevoPago` notifica al alumno; mismo guard de $0.
  - `cursos-singulares.facade.spec.ts`: `marcarEnrollmentPagado` notifica al alumno resuelto vía `standalone_course_enrollments`.
  - `servicios-especiales.facade.spec.ts`: `registrarCobro` notifica solo si `student_id` no es null; cliente externo (`student_id=null`) no dispara notificación ni error.
  - `evaluaciones-profesional.facade.spec.ts`: `confirmarNotas` notifica a cada alumno único de `g.filas`; mensaje distinto si `promedioAprobado === false`; batch resuelve N enrollments en 1 sola query.
  - Fallo de INSERT de notificación en cualquiera de los 7 → la mutación principal (pago/anticipo/liquidación/notas) igual se marca exitosa (AC-E1, patrón `.catch()` de Ola 1).
- **Sin tests de componentes** (no aplica — Ola 2 no toca ningún componente).
- **QA manual/Playwright (`/verify`):** registrar un pago presencial de prueba → campana del alumno recibe en vivo; confirmar notas con un módulo reprobado → mensaje distinto visible; registrar anticipo → campana del instructor; pagar liquidación → campana del instructor; simular pago online (Webpay integración) → alumno + secretaria reciben; activar cuenta de alumno nuevo → notificación queda esperando (verificar tras primer login).
- **EF:** sin harness de test automatizado (igual que Ola 1) — verificación manual con `npx supabase start`. Prioridad alta en QA porque son los 2 únicos productores sin cobertura de Vitest.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| `special_service_sales.student_id` null para ventas a clientes externos (`is_student=false`) → intentar resolver un `student_id` inexistente | Alta si no se guarda | Guard explícito `if (venta.student_id == null) return` antes de intentar resolver — cubierto en AC1 variante |
| `EvaluacionesProfesionalFacade.confirmarNotas()` puede confirmar notas de un curso con 0 alumnos con nota válida (`upserts.length === 0`) → no debería notificar | Media | Reusar el mismo guard que ya existe en `_persist` (`if (upserts.length === 0) return true` sin notificar) — no se notifica si no hubo nada que confirmar |
| Reenvío de invitación (`activate-student-account`, rama "reinvited") duplica la notificación de bienvenida si no se guarda el guard | Alta si se olvida | Notificación **solo** en la rama `!targetUser.supabase_uid` (primera vez), nunca en la rama de reenvío — explícito en el plan §2 |
| Pago online (B2) con `enrollment.branch_id` null o sede sin secretarias activas | Baja | Mismo patrón que B1 en Ola 1: si `notifyIds.length === 0`, no se hace el INSERT (no es error) |
| `LiquidacionRow.userId` podría venir `0` si el join `instructors.users` falla (línea 311: `u?.id ?? 0`) → notificar a un usuario inexistente | Baja | Guard `if (row.userId) notify(...)` antes de disparar |
| Los 7 Facades tocados no comparten un util de resolución → riesgo de copy-paste con bugs sutiles entre las 3 variantes de "pago presencial" | Media | Mismo código de resolución (`resolveStudentUserId` por `enrollmentId`) se testea igual en los 3 specs — no se abstrae a un util compartido (decisión consciente, ver §3, mismo criterio que Ola 1) pero SÍ se testea 3 veces |

---

## 9. Orden de implementación

1. **A7 — Liquidaciones (el más simple, sin resolución de FK):** TDD del helper de notificación en `liquidaciones.facade.spec.ts` → implementar.
2. **A6 — Anticipos:** TDD + helper `resolveInstructorUserIds` local → implementar.
3. **A4 — Pago presencial (3 variantes):** `enrollment-payment` → `pagos` → `cursos-singulares` → `servicios-especiales` (mismo patrón, orden por complejidad creciente del guard).
4. **A5 — Notas confirmadas:** TDD del batch resolver + mensaje condicional por `promedioAprobado`.
5. **B2 — Pago online (EF):** ampliar query + INSERT batch en `student-payment/index.ts`, prueba local con `npx supabase start`.
6. **B3 — Cuenta activada (EF):** INSERT en rama "invited" de `activate-student-account/index.ts`, prueba local.
7. **Validación:** `npm run lint:arch`, tests por archivo tocado (no suite global), `ng build`, `/verify` Playwright.
8. `/spec-verify` → `acceptance.md`.

---

## 10. Estimación

**M — 2 días.** Día 1: pasos 1-4 (productores client-side, los 5 facades). Día 2: pasos 5-8 (las 2 EFs + QA + acceptance).

---

## Changelog

- 2026-07-07 — plan inicial (talla M por analogía con Spec 0024, sin pausa de confirmación — spec ya traía las decisiones de alcance cerradas)
