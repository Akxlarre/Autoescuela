# Spec 0035 — App-like: `/alumno/dashboard`

> **Status:** draft
> **Created:** 2026-08-07
> **Owner:** b
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación ASG-b-083 (`specs/assignments/ASG-b-083-app-like-alumno-dashboard.md`) — Paso 15 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`).

**Persona afectada:** Alumno (portal alumno, `/alumno/dashboard`).

**Problema que resuelve:**
`AlumnoDashboardComponent` todavía no sigue el patrón app-like (fill-screen desktop / scroll interno) que ya tienen las páginas equivalentes de admin/secretaria. El layout real es bastante más denso de lo que asumía la primera pasada del audit original: hero + selector-matrícula + 2 `bento-square` + columna izquierda/derecha de 2 filas cada una (`bento-activity-lg`/`bento-alerts-lg`, mismo patrón de 2 columnas que `DashboardComponent` de admin) + otra `.bento-banner` + 2 `bento-square` más al final — son ~9 celdas condicionales, no la versión simplificada (hero + 2 columnas) que se pensó originalmente. No se llegó a mapear en detalle cuáles celdas son siempre visibles, cuáles condicionales, y si pueden coexistir varias condicionales a la vez — el mismo problema recurrente que ya apareció en `alumno/horario`/`alumno/pagos` (ASG-b-070/ASG-b-079).

**Hipótesis de valor:**
Consistencia visual y de UX con el resto del rollout app-like ya aplicado en admin/secretaria. Impacto relativamente menor: el portal alumno es mobile-first y el patrón app-like solo aporta en desktop/laptop, por lo que esta pieza es de prioridad menor que el resto del rollout y no bloquea nada si queda para el final.

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

- Pantalla(s) afectada(s): `src/app/features/alumno/dashboard/alumno-dashboard.component.ts`
- Flujo principal (happy path): …
- Estados especiales (loading, error, vacío): …

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- {{métrica 1}}
- {{métrica 2}}

---

## 9. Notas / decisiones abiertas

- [ ] Mapear las ~9 celdas en detalle: cuáles son siempre visibles, cuáles condicionales, y si pueden coexistir varias condicionales a la vez (mismo problema recurrente que `alumno/horario`/`alumno/pagos`, ASG-b-070/ASG-b-079 — puede necesitar el mismo fix de "agrupar en un wrapper").
- [ ] Confirmar que la base (2 columnas activity/alerts) reutiliza `--fill-screen-2` de `DashboardComponent` de admin (`src/app/features/dashboard/dashboard.component.ts`) — esto ya está confirmado por el audit y no hace falta reinvestigar.
- [ ] Decidir qué pasa con las 4 `bento-square` sueltas y la `.bento-banner` extra: ¿se pliegan en la fila de KPIs? ¿necesitan su propia fila? Requiere leer el componente completo.
- [ ] Checklist de cierre específico del rollout app-like (además de lo normal de una spec): `force-compact` verificado con drawer abierto; `.spec.ts` para cualquier lógica de densidad nueva; `/verify` en 390×844, 1440×900 y 768 de alto.
- Originado de Asignación ASG-b-083 (`specs/assignments/ASG-b-083-app-like-alumno-dashboard.md`)

---

## Changelog

- 2026-08-07 — draft inicial por b (vía /assign-claim desde ASG-b-083)
