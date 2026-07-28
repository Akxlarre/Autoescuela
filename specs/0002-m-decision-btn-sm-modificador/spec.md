# Spec 0002-m — Decisión de diseño: modificador btn-sm

> **Status:** draft
> **Created:** 2026-07-28
> **Owner:** Matías
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación ASG-008 (`specs/assignments/ASG-008-decision-btn-sm.md`), creada por Benjamín.

**Persona afectada:** Equipo de desarrollo (deuda técnica del Design System, sin impacto directo visible para usuarios finales).

**Problema que resuelve:**
El linter `lint:arch` (regla ARCH-16) detectó que 3 archivos (`asistencia-clase-b-content.component.ts`, `certificacion-clase-b-content.component.ts`, `certificacion-profesional-content.component.ts`) montan utilities de tamaño de Tailwind directamente sobre clases `btn-*`, lo cual está prohibido por el Design System. El patrón está replicado en ~120 instancias en todo el repo (backlog ya documentado en `docs/BACKLOG-DEUDA-TECNICA.md`, línea 86-88). La causa raíz es que el DS no tiene un modificador de tamaño compacto — hoy la única forma de conseguir un botón chico es "mutilando" la utilidad base.

**Hipótesis de valor:**
Con un modificador `btn-sm` componible en el DS, se cierra la brecha que originó las ~120 instancias del anti-patrón y se resuelven los 3 archivos que quedaron deferidos del fix ARCH-16 original (`fix-054-b-arch16-ratchet-btn-utilities`).

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

- ❌ Migrar las ~120 instancias del anti-patrón en el resto del repo (queda en el backlog de deuda técnica).
- ❌ {{otra cosa que NO va}}

---

## 5. Dependencias

### Specs previas
- `fix-054-b-arch16-ratchet-btn-utilities` (resolvió los otros 3 archivos "limpios" de la misma regresión ARCH-16) — done

### Capacidades del proyecto que se asumen existentes
- `src/tailwind.css` con las utilities `btn-*` actuales del Design System.

### Capacidades nuevas requeridas
- Modificador componible `btn-sm` (o similar) en `src/tailwind.css` — **NO** crear `btn-primary-sm`/`btn-danger-sm`/… por tipo (explosión combinatoria ya descartada en el backlog).

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas nuevas / modificadas: ninguna.
- Modelos UI nuevos: ninguno.
- RLS requerida: n/a.

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): `asistencia-clase-b-content`, `certificacion-clase-b-content`, `certificacion-profesional-content`.
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
- Originado de Asignación ASG-008 (specs/assignments/ASG-008-decision-btn-sm.md)

---

## Changelog

- 2026-07-28 — draft inicial por Matías (reclamada desde ASG-008)
