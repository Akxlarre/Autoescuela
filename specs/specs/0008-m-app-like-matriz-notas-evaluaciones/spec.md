# Spec 0008 — App-like: matriz de notas (Evaluaciones profesional)

> **Status:** draft
> **Created:** 2026-08-10
> **Owner:** m
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación ASG-b-080 (specs/assignments/ASG-b-080-app-like-matriz-de-notas.md) —
paso 13 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`).

**Persona afectada:** Admin y Secretaria (dos rutas distintas para el mismo dominio funcional).

**Problema que resuelve:**
`AdminProfesionalEvaluacionesComponent` (828 líneas, ruta `/admin/clase-profesional/evaluaciones`)
y `SecretariaProfesionalNotasComponent` (758 líneas, ruta `/secretaria/profesional/notas`) son
casi-clones exactos — mismo CSS sticky inline, mismo modo dual "aterrizaje"/"grilla" — que hoy
divergen en tres formas que confunden al usuario y generan deuda: (1) ninguno de los dos sigue el
patrón app-like (fill-screen desktop / scroll interno), (2) tienen un bug de UI concreto en
secretaria — el badge de estado de curso ("Sin iniciar") no separa ícono y texto porque falta el
wrapper `<span class="inline-flex items-center gap-1">` que sí existe en admin — y (3) el nombre
del feature está fragmentado en tres formas distintas en el código: label de menú admin dice
"Evaluaciones" (`menu-config.service.ts:96`), label de menú secretaria dice "Calificaciones"
(`menu-config.service.ts:223`), y las rutas usan `/evaluaciones` vs `/notas`.

**Decisión de nomenclatura (confirmada por el owner):** el nombre canónico es **"Evaluaciones"**,
porque es el término que usa el libro de clases oficial del rubro (registro exigido por la
normativa de escuelas de conductores). Esta spec unifica labels de menú, título de página, Y
rutas/URLs de ambos componentes a `evaluaciones`.

**Hipótesis de valor:**
Un solo nombre y un solo comportamiento visual para el mismo feature en las dos rutas elimina
confusión de terminología entre roles, corrige un bug visible, y suma la matriz de notas al
rollout app-like (mejor uso del alto de pantalla en desktop, sin romper el scroll bidireccional
sticky ya construido a mano).

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

- [ ] {{pregunta pendiente para el usuario}}
- [ ] {{decisión a tomar antes de planificar}}
- Originado de Asignación ASG-b-080 (specs/assignments/ASG-b-080-app-like-matriz-de-notas.md)

---

## Changelog

- 2026-08-10 — draft inicial por m
