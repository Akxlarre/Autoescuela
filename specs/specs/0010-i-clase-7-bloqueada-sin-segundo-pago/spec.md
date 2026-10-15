# Spec 0010-i — Clase 7 bloqueada sin el segundo pago (con habilitación rápida y forzado)

> **Status:** approved
> **Created:** 2026-10-13
> **Owner:** Ignacio (i)
> **Priority:** P0

---

## 1. Contexto de negocio

**Origen:** Asignación `ASG-i-062` (specs/assignments/ASG-i-062-clase-7-bloqueada-sin-segundo-pago.md),
salida de la revisión de "Dejar pago pendiente — Cobrar después" (2026-10-13, al descartar `ASG-i-060`).
Requisito explícito del cliente.

**Persona afectada:** Secretaria y Admin (cobran y habilitan en el mesón); Instructor (inicia la clase
desde su app); Alumno de Clase B con saldo pendiente.

**Problema que resuelve:**
El alumno de Clase B empieza siempre con sus 12 clases agendadas, pero **no puede tomar la clase 7 si
no pagó la segunda parte**. Hoy el sistema no aplica nada de esto (verificado en código el 2026-10-13):

- Con saldo pendiente se inician y completan las 12 clases. Ni la agenda, ni los facades, ni ningún
  trigger miran `pending_balance`. Una clase se inicia desde dos lugares: Asistencia Clase B
  (secretaria) y la app del instructor.
- "Cobrar después" (paso 4 del wizard de matrícula) deja la matrícula activa con el 100% del saldo y
  tampoco frena nada.
- El certificado Clase B se habilita al completar la clase 12 sin mirar el saldo
  (`verify_class_b_certificate_enablement`). Profesional sí exige saldo 0.
- El único aviso de cobro (`notify_deposit_reminder`, tras la clase 6) solo cubre
  `payment_mode = 'partial'` y solo le llega al alumno, no al personal.
- La matrícula online promete lo contrario: *"Pagas el 50% ahora y agendas igualmente tus N clases.
  El saldo lo completas cuando quieras"*.

En el mesón el caso es rápido: el alumno llega, paga y sube al auto. La secretaria tiene que **ver**
que la clase está bloqueada (no se le oculta), cobrar y habilitarla al tiro, o forzarla en un caso
especial. Si no se resuelve, la escuela entrega las 12 clases y el certificado sin cobrar la segunda
parte, y nadie del personal se entera.

**Hipótesis de valor:**
Ninguna clase 7+ se inicia con saldo pendiente sin que quede registrado un pago o un forzado con
motivo, y el trámite en el mesón no agrega más de un paso al flujo actual.

**Alcance confirmado al reclamar (Ignacio, 2026-10-13):**

1. Bloqueo en la BD: no se puede pasar a `in_progress` una clase con `class_number >= 7` si la matrícula
   tiene `pending_balance > 0` y no fue habilitada a mano. Agendar sigue libre.
2. Asistencia Clase B muestra la clase como "Bloqueada: pago pendiente $X" con botón "Registrar pago"
   (drawer de pago existente, precargado); al guardar se puede iniciar al tiro.
3. "Habilitar sin pago" con motivo obligatorio, para **secretaria y admin**; registra quién, cuándo y
   por qué, y avisa al admin.
4. App del instructor: mensaje claro si la clase está bloqueada.
5. Aviso tras la clase 6 para toda matrícula con saldo, también al personal de la sede.
6. Certificado Clase B con deuda: confirmación con motivo obligatorio y registro (secretaria y admin).
7. Corregir el texto de la matrícula online.

Se puede ejecutar en entregas chicas (Ignacio, 2026-10-13): primero 1–4 (el requisito del cliente),
luego 5–7.

---

## 2. User Stories

- **US1**: Como dueño de la escuela, quiero que la clase 7 no se pueda iniciar si el alumno no pagó
  la segunda parte, para no entregar la mitad del curso sin cobrarla.
- **US2**: Como secretaria, quiero ver en la misma pantalla de inicio de clase que está bloqueada y
  cuánto debe el alumno, y poder cobrarle ahí mismo, para que suba al auto sin perder la hora.
- **US3**: Como secretaria o admin, quiero habilitar las clases sin pago en un caso especial dejando
  el motivo, para no frenar una situación excepcional y que quede constancia.
- **US4**: Como instructor, quiero un mensaje claro si la clase de mi alumno está bloqueada, para
  mandarlo a secretaría en vez de ver un error que no entiendo.
- **US5**: Como secretaria o admin, quiero enterarme cuando un alumno con deuda completa la clase 6,
  para cobrarle antes de que llegue a la 7.
- **US6**: Como secretaria o admin, quiero que el certificado de un alumno con deuda me pida
  confirmación y motivo, para no entregarlo por descuido pero sí poder hacerlo en un caso especial.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

> "Matrícula con deuda" = matrícula Clase B con `pending_balance > 0`. El saldo solo baja con pagos
> `status = 'paid'` (`recalculate_enrollment_balance()`).

### Entrega 1 — Bloqueo, cobrar y forzar (US1–US4; AC1–AC6 + AC10)

- **AC1 (bloqueo en BD)**: Given una matrícula con deuda, no habilitada a mano, y su clase 7 en
  `scheduled`, When cualquier usuario intenta pasarla a `in_progress` o `completed` (Asistencia
  admin/secretaria, dashboards o app del instructor), Then la BD rechaza el cambio con el código
  `PAGO_PENDIENTE_CLASE_7` y la clase sigue `scheduled`. Igual para las clases 8–12.
- **AC2 (lo que sigue libre)**: Given la misma matrícula, When se inicia una clase 1–6, o se agenda o
  reagenda cualquiera de las 12, Then el sistema lo permite igual que hoy.
- **AC3 (la secretaria lo ve)**: Given AC1, When secretaria o admin abre "Iniciar Clase Práctica" para
  esa clase (desde Asistencia o desde un dashboard), Then el drawer muestra "Bloqueada: pago pendiente
  $X" con el saldo real, y en vez de "Iniciar" ofrece "Registrar pago" y "Habilitar sin pago".
- **AC4 (cobrar al tiro)**: Given AC3, When pulsa "Registrar pago", Then se abre el drawer de pago
  existente con la matrícula y el saldo precargados; y When registra un pago que deja el saldo en 0,
  Then puede iniciar la clase sin recargar la página ni cambiar de pantalla.
- **AC5 (forzar)**: Given AC3, When secretaria o admin pulsa "Habilitar sin pago" y confirma con un
  motivo, Then queda registrado quién, cuándo y por qué; los admins reciben una notificación con
  alumno, monto y motivo; y las clases 7–12 de esa matrícula se pueden iniciar. Sin motivo no se
  puede confirmar.
- **AC10 (recordatorio en cada clase forzada)**: Given una matrícula habilitada sin pago que sigue
  con deuda, When se inicia cualquiera de sus clases 7–12, Then las secretarias de su sede reciben
  una notificación "<alumno> está tomando la clase N sin haber pagado: debe $X"; y el drawer de
  inicio muestra "Habilitada sin pago — debe $X" con el botón "Registrar pago". Si el alumno ya
  pagó todo, no llega ningún aviso.
- **AC6 (instructor)**: Given AC1, When el instructor intenta iniciar la clase desde su app, Then ve
  "Pago pendiente: el alumno debe pasar por secretaría" y la clase no se inicia.

### Entrega 2 — Aviso, certificado y texto (US5–US6)

- **AC7 (aviso tras la clase 6)**: Given una matrícula con deuda, con cualquier modalidad de pago
  (abono o total), When se completa su clase 6, Then el alumno recibe el aviso de pago y las
  secretarias de su sede y los admins reciben una notificación con alumno y monto.
- **AC8 (certificado con deuda)**: Given un alumno con las 12 clases y deuda, When secretaria o admin
  genera su certificado, Then el sistema pide confirmación mostrando el monto y un motivo
  obligatorio; al confirmar se genera y queda registrado quién, cuándo y por qué; sin confirmar no se
  genera. La validación vive en la edge function `generate-certificate-b-pdf`, no solo en la UI.
- **AC9 (texto de la matrícula online)**: Given la matrícula online, When el alumno elige abono, Then
  el texto dice que la segunda parte se paga antes de la clase 7 (ya no "cuando quieras").

### Edge cases obligatorios

- **AC-E1**: Given una matrícula con deuda que recibe un pago parcial (saldo sigue > 0), When se
  intenta iniciar la clase 7, Then sigue bloqueada.
- **AC-E2**: Given un pago registrado como "Cobrar después" (`status = 'pending'`), Then no baja el
  saldo ni desbloquea la clase 7.
- **AC-E3**: Given una clase 7+ ya `in_progress`, When se finaliza, o se marca una clase como ausente
  (`no_show`), Then el bloqueo no interfiere.
- **AC-E4**: Given una secretaria de otra sede, When intenta habilitar sin pago una matrícula que no
  es de su sede, Then la BD lo rechaza.
- **AC-E5**: Given "Generar pendientes" (certificados en lote), When hay alumnos con deuda, Then se
  saltan y el resumen dice cuántos quedaron fuera por deuda (se certifican uno a uno, con AC8).
- **AC-E6**: Given que falla guardar el forzado, Then la clase sigue bloqueada y se muestra el error
  (nunca un "habilitado" que no quedó guardado).

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Bloquear el agendamiento: las 12 clases se agendan siempre.
- ❌ Alertas en el dashboard (descartadas por Ignacio el 2026-10-13).
- ❌ Calcular "la segunda cuota" por separado: el criterio es saldo total > 0.
- ❌ Deshacer un forzado desde la UI.
- ❌ Clase Profesional (ya exige saldo 0 para el certificado) y "Refuerzo Clase B" (6 clases).
- ❌ Cambiar el forzado existente por clases incompletas del certificado (solo admin): sigue igual.

---

## 5. Dependencias

### Specs previas
- Ninguna. Conviene que `fix-045-i` (sobrepago, `FOR UPDATE`) ya esté en `main`: está cerrada.

### Capacidades del proyecto que se asumen existentes
- `enrollments.pending_balance` mantenido por `trg_update_balance`.
- `PagosFacade.seleccionarParaPago(enrollmentId)` + `RegistrarPagoDrawerComponent` (precarga ya usada
  desde la ficha del alumno).
- `AdminIniciarClaseDrawerComponent`: único drawer de inicio para Asistencia y dashboards.
- `notify_deposit_reminder()` y el patrón de aviso a secretarias de la sede
  (`20260810120000_fix148_notify_secretary_detail_and_actor.sql`).
- `generate-certificate-b-pdf` con su gate de clases (`force` solo admin).

### Capacidades nuevas requeridas
- Registro de habilitaciones manuales (clases y certificado) con motivo, autor y fecha.
- Trigger de bloqueo en `class_b_sessions`.

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas nuevas / modificadas: tabla nueva de habilitaciones (`enrollment_id`, tipo `clases` |
  `certificado`, `reason`, `created_by`, `created_at`), solo inserción. Alternativa a evaluar en el
  plan: columnas en `enrollments`.
- Modelos UI nuevos: estado de bloqueo en `ClasePracticaRow` (o en el drawer de inicio).
- RLS requerida: insertar habilitaciones solo secretaria (su sede) y admin; nadie las modifica ni
  borra.

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): drawer "Iniciar Clase Práctica" (Asistencia admin/secretaria y
  dashboards), app del instructor, Certificación Clase B y ficha del alumno (generar certificado),
  matrícula online.
- Flujo principal (happy path): secretaria abre la clase 7 → ve "Bloqueada: pago pendiente $X" →
  "Registrar pago" → cobra → vuelve al drawer → "Iniciar".
- Estados especiales (loading, error, vacío): error al forzar (AC-E6); saldo que cambia mientras el
  drawer está abierto (se relee al volver del pago).

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- Cero clases 7+ iniciadas con deuda sin un pago o un forzado registrado.
- Cantidad de forzados por mes (si crece mucho, la regla no calza con la operación real).

---

## 9. Notas / decisiones abiertas

- [x] **Forzado por matrícula, no por clase** (Ignacio, 2026-10-13): habilitar sin pago en la clase 7
      deja habilitadas también las 8–12 de esa matrícula.
- [x] **Matrículas en curso sin tratamiento especial** (Ignacio, 2026-10-13): el bloqueo aplica igual a
      las que ya van por la clase 7+ al subir el cambio; no hace falta migrar ni avisar.
- [x] **"Refuerzo Clase B" (6 clases) queda fuera**: nunca llega a la clase 7.
- [x] **Quién fuerza:** secretaria y admin, con motivo obligatorio y aviso al admin (inicio de clase y
      certificado).
- [x] **Habilitar las clases sin pago NO habilita el certificado** (Ignacio, 2026-10-13, opción A):
      si al llegar al certificado sigue la deuda, se vuelve a pedir confirmación y motivo.
- [x] **Recordatorio en cada clase forzada** (Ignacio, 2026-10-13): mientras siga la deuda, cada clase
      7–12 que se inicia avisa a la secretaria (AC10). Se avisa al **iniciar** la clase, que es
      cuando el alumno está presente para cobrarle.
- [x] **¿A quién notifica un forzado (AC5/AC8)?** A todos los admins activos, y además queda en la
      Auditoría (Ignacio, 2026-10-13).
- Coordinar con Matías: `fix-366-m` (ASG-i-027) testea Asistencia Clase B y esta spec cambia su
  comportamiento.
- Originado de Asignación ASG-i-062 (specs/assignments/ASG-i-062-clase-7-bloqueada-sin-segundo-pago.md)

---

## Changelog

- 2026-10-13 — draft inicial por Ignacio (i), reclamado desde ASG-i-062
