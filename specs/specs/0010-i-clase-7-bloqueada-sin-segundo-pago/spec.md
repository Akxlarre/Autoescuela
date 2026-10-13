# Spec 0010-i — Clase 7 bloqueada sin el segundo pago (con habilitación rápida y forzado)

> **Status:** draft
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

- **US1**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US2**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US3**: …

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given {{precondición}}, When {{acción}}, Then {{resultado observable}}.
- **AC2**: Given {{precondición}}, When {{acción}}, Then {{resultado observable}}.
- **AC3**: …

### Edge cases obligatorios

- **AC-E1**: Given {{caso límite}}, When …, Then …
- **AC-E2**: …

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ {{cosa que NO va}}
- ❌ {{otra cosa que NO va}}

---

## 5. Dependencias

### Specs previas
- (IDs de specs que deben estar `done` antes, o "ninguna")

### Capacidades del proyecto que se asumen existentes
- (ej. "AuthFacade con currentUser()", "tabla `users` con RLS")

### Capacidades nuevas requeridas
- (ej. "tabla `pre_enrollments` nueva", "endpoint público sin auth")

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas nuevas / modificadas: …
- Modelos UI nuevos: …
- RLS requerida: …

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): …
- Flujo principal (happy path): …
- Estados especiales (loading, error, vacío): …

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- {{métrica 1}}
- {{métrica 2}}

---

## 9. Notas / decisiones abiertas

- [x] **Forzado por matrícula, no por clase** (Ignacio, 2026-10-13): habilitar sin pago en la clase 7
      deja habilitadas también las 8–12 de esa matrícula.
- [x] **Matrículas en curso sin tratamiento especial** (Ignacio, 2026-10-13): el bloqueo aplica igual a
      las que ya van por la clase 7+ al subir el cambio; no hace falta migrar ni avisar.
- [x] **"Refuerzo Clase B" (6 clases) queda fuera**: nunca llega a la clase 7.
- [x] **Quién fuerza:** secretaria y admin, con motivo obligatorio y aviso al admin (inicio de clase y
      certificado).
- [ ] {{decisión a tomar antes de planificar}}
- Coordinar con Matías: `fix-366-m` (ASG-i-027) testea Asistencia Clase B y esta spec cambia su
  comportamiento.
- Originado de Asignación ASG-i-062 (specs/assignments/ASG-i-062-clase-7-bloqueada-sin-segundo-pago.md)

---

## Changelog

- 2026-10-13 — draft inicial por Ignacio (i), reclamado desde ASG-i-062
