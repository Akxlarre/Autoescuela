# Spec {{ID}} — {{TITLE}}

> **Status:** draft
> **Created:** {{DATE}}
> **Owner:** {{OWNER}}
> **Priority:** {{P0|P1|P2}}

---

## 1. Contexto de negocio

**Origen:** (link a ticket, conversación, documento, o "iniciativa interna")

**Persona afectada:** (rol primario: ej. Secretaria, Admin, Alumno)

**Problema que resuelve:**
(2-4 frases. Qué duele hoy, por qué duele, qué pasa si no lo resolvemos.)

**Hipótesis de valor:**
(1 frase. Qué creemos que mejora cuando esto exista. Métrica si aplica.)

---

## 2. User Stories

- **US1**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US2**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US3**: …

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no podés escribir un test o un check
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

- [ ] {{pregunta pendiente para el usuario}}
- [ ] {{decisión a tomar antes de planificar}}

---

## Changelog

- {{DATE}} — draft inicial por {{OWNER}}
