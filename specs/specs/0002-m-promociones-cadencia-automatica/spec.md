# Spec 0002-m — Promociones automáticas: cadencia, matrícula tardía y convalidaciones

> **Status:** draft
> **Created:** 2026-07-28
> **Owner:** m
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Asignación ASG-035 (`specs/assignments/ASG-035-promociones-cadencia-automatica.md`),
originada en la reunión con el cliente del 2026-07-28.

**Persona afectada:** Secretaria y Admin (creación/gestión de promociones y matrícula
Profesional).

**Problema que resuelve:**
Hoy las promociones (`professional_promotions`) se crean a mano. El cliente pidió que se
generen automáticamente cada 14 días (siempre lunes), que el sistema tolere libros de clase
sin alumnos si nadie se matriculó a esa promoción, y que el wizard de matrícula Profesional
permita elegir entre varias promociones activas a la vez (porque con cadencia de 14 días
siempre hay más de una viva). También pidió flexibilizar la matrícula tardía: normalmente los
alumnos se matriculan antes de que la promoción arranque, pero debe poder hacerse hasta 3 días
después de iniciada.

**Nota de alcance:** esta spec agrupa 3 de las 4 anotaciones originales de ASG-035. La cuarta
(convalidaciones: si su fecha de inicio se deriva por regla fija del libro padre o se decide
caso a caso) sigue **bloqueada** por falta de definición del cliente — no forma parte del
alcance activo de esta spec hasta que se resuelva (ver sección 9).

**Hipótesis de valor:**
Elimina la creación manual de promociones y reduce fricción en matrícula tardía, sin dejar
huecos de calendario (siempre existe la próxima promoción, aunque termine vacía).

---

## 2. User Stories

- **US1**: Como Secretaria, quiero que el sistema cree automáticamente la promoción del
  próximo lunes (con su libro de clase asociado) para no tener que crearla a mano cada 2
  semanas.
- **US2**: Como Secretaria, quiero ver todas las promociones activas (no solo una) al
  matricular a un alumno Profesional, para poder elegir la correcta cuando hay 2 solapadas.
- **US3**: Como Secretaria, quiero poder matricular a un alumno hasta 3 días después de que
  la promoción ya comenzó, para no perder matrículas por llegar tarde unos días.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given que hoy es una fecha cualquiera, When corre el proceso automático, Then
  siempre existe en BD una `professional_promotions` con `start_date` = el próximo lunes que
  corresponda según la cadencia de 14 días, con su `class_book` ya creado.
- **AC2**: Given una promoción recién creada automáticamente sin ningún alumno matriculado,
  When se consulta su estado, Then el sistema no la marca como error ni la bloquea — un libro
  vacío es un estado válido.
- **AC3**: Given que hay 2 promociones con status `planned`/`in_progress` vigentes al mismo
  tiempo, When la secretaria abre el selector de promoción en el wizard de matrícula
  Profesional, Then ve ambas listadas (no solo la más reciente).
- **AC4**: Given una promoción que comenzó hace 3 días o menos, When la secretaria intenta
  matricular a un alumno en ella, Then el sistema lo permite.

### Edge cases obligatorios

- **AC-E1**: Given una promoción que comenzó hace más de 3 días, When la secretaria intenta
  matricular a un alumno en ella, Then {{a definir: ¿bloqueo duro o advertencia salvable por
  admin? — el cliente pidió "la mayor flexibilidad", falta confirmar si el tope de 3 días es
  estricto}}.
- **AC-E2**: Given que el cron/trigger de creación automática corre más de una vez sin que
  haya pasado una nueva cadencia de 14 días, When se ejecuta, Then no debe crear promociones
  duplicadas para el mismo `start_date`.

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Convalidaciones (fecha de inicio derivada del padre vs. caso a caso) — bloqueado,
  pregunta pendiente al cliente. Ver `specs/assignments/ASG-035-promociones-cadencia-automatica.md`.
- ❌ Cambios al motor de transición de status ya existente
  (`auto_transition_promotion_status()`, `cascade_promotion_status_to_courses()`) — el
  trigger nuevo debe convivir con ellos, no reemplazarlos.

---

## 5. Dependencias

### Specs previas
- Ninguna directa. Relacionada con el modelo de `professional_promotions` /
  `promotion_courses` documentado en `indices/DATABASE.md`.

### Capacidades del proyecto que se asumen existentes
- `auto_transition_promotion_status()` (pg_cron diario) — transiciona
  `planned→in_progress→finished` según `start_date`/`end_date`.
- `cascade_promotion_status_to_courses()` — propaga status a `promotion_courses`.
- Auto-insert de `class_book` existente (migración `20260405100000`) — verificar que siga
  cubriendo la creación automática nueva.

### Capacidades nuevas requeridas
- Trigger/cron SQL que garantice la existencia de la promoción del próximo lunes según la
  cadencia de 14 días.
- Selector de promoción en el wizard de matrícula Profesional capaz de listar varias
  promociones activas simultáneamente.
- Validación de matrícula tardía (tope o advertencia de 3 días).

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas existentes involucradas: `professional_promotions`, `promotion_courses`,
  `class_book`.
- Tablas nuevas / modificadas: por definir en `plan.md` (probablemente ninguna columna nueva
  — la cadencia se calcula a partir de `start_date` de la última promoción, no se guarda como
  configuración).
- RLS requerida: reutilizar las policies ya existentes de `professional_promotions` (INSERT
  vía `admin`/`secretary` — el trigger corre con rol de servicio).

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): wizard de matrícula Profesional (paso de selección de
  promoción/curso).
- Flujo principal (happy path): la secretaria abre el wizard, ve la lista de promociones
  activas (puede haber 2), elige la correspondiente, continúa la matrícula normal.
- Estados especiales: promoción recién creada sin alumnos (debe listarse igual si está
  vigente); matrícula tardía (posible advertencia visual si está dentro de los 3 días).

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- Cero promociones creadas manualmente después del despliegue.
- Cero huecos de calendario (semanas sin promoción vigente cuando debería haber una).

---

## 9. Notas / decisiones abiertas

- [ ] AC-E1: ¿el tope de 3 días para matrícula tardía es duro o el admin puede saltárselo?
- [x] Cadencia de promociones (14 días) y solapamiento — confirmado por Matías (owner) el
  2026-07-28, ya no es una pregunta abierta. `indices/DATABASE.md` actualizado.
- Convalidaciones quedan fuera de esta spec (ver sección 4) hasta que el cliente responda.
- Originado de Asignación ASG-035 (specs/assignments/ASG-035-promociones-cadencia-automatica.md)

---

## Changelog

- 2026-07-28 — draft inicial por m, a partir de ASG-035.
