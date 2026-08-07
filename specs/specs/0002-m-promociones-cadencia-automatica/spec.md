# Spec 0002-m — Promociones automáticas: cadencia, matrícula tardía y convalidaciones

> **Status:** done
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

## ✅ Desbloqueada (2026-08-06) — respuestas del cliente

Los 2 huecos que bloqueaban el plan quedaron resueltos por Matías (owner):

1. **Días de clase: confirmado lunes a sábado, 5 semanas (30 clases).** No era un bug — el
   trigger `generate_sessions_from_promotion()` ya se comporta correctamente. La duración de
   una promoción es entonces `start_date` + 5 semanas L-S, lo que fija `end_date` para el
   cálculo automático. Este dato es nuevo respecto al draft inicial (no estaba escrito en
   `indices/DATABASE.md`) y debe incorporarse ahí y al `plan.md` — el trigger nuevo necesita
   derivar `end_date` a partir de esta regla, no recibirlo como input manual.
2. **Feriados: se maneja con una Edge Function programada**, no con un trigger SQL puro. La
   automatización de creación de promociones hace el `fetch()` a la API de feriados y aplica
   `cancelHolidaySessions()` (misma lógica que hoy corre en `promociones.facade.ts` desde el
   navegador), pero disparada por cron en vez de por el flujo manual del wizard.

**Sigue sin definir (fuera de esta spec, ver sección 4):** convalidaciones — pregunta 3 de
ASG-035. No bloquea el resto del alcance.

---

## 2. User Stories

- **US1**: Como Secretaria, quiero que el sistema cree automáticamente la promoción del
  próximo lunes (con su libro de clase asociado) para no tener que crearla a mano cada 2
  semanas.
- **US5**: Como Admin o Secretaria, quiero que si hay feriados dentro del rango de una
  promoción (creada manual o automáticamente), la fecha de término se extienda lo necesario
  para que la promoción complete siempre sus 30 clases reales, en vez de perderlas.
- **US2**: Como Secretaria, quiero ver todas las promociones activas (no solo una) al
  matricular a un alumno Profesional, para poder elegir la correcta cuando hay 2 solapadas.
- **US3**: Como Secretaria, quiero poder matricular a un alumno hasta 3 días después de que
  la promoción ya comenzó, para no perder matrículas por llegar tarde unos días.
- **US4**: Como Admin o Secretaria, quiero que el sistema me avise con claridad si intento
  matricular en una promoción que ya lleva más de 3 días iniciada, para decidir con
  conocimiento si de todas formas quiero hacerlo.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given que hoy es una fecha cualquiera, When corre el proceso automático, Then
  siempre existe en BD una `professional_promotions` con `start_date` = el próximo lunes que
  corresponda según la cadencia de 14 días, con su `class_book` ya creado.
- **AC1b**: Given que se crea automáticamente una promoción nueva, When se le asigna su
  `code`, Then el valor es `code` de la última promoción existente + 1 (secuencia global, ej.
  si la última fue `245`, la nueva es `246`) y se propaga a `promotion_courses.code` como
  `"{code}.{sufijo licencia}"` (mismo formato y helper que usa hoy `editarPromocion()` /
  `propagateCodeToCourses()` en `promociones.facade.ts` — no se inventa formato nuevo).
- **AC2**: Given una promoción recién creada automáticamente sin ningún alumno matriculado,
  When se consulta su estado, Then el sistema no la marca como error ni la bloquea — un libro
  vacío es un estado válido.
- **AC3**: Given que hay 2 promociones con status `planned`/`in_progress` vigentes al mismo
  tiempo, When la secretaria abre el selector de promoción en el wizard de matrícula
  Profesional, Then ve ambas listadas (no solo la más reciente).
- **AC4**: Given una promoción que comenzó hace 3 días o menos, When la secretaria (o el
  admin) intenta matricular a un alumno en ella, Then el sistema lo permite sin advertencia.
- **AC5**: Given una promoción que comenzó hace más de 3 días, When la secretaria o el admin
  intenta matricular a un alumno en ella, Then el sistema muestra un modal indicando
  claramente que ya pasaron más de 3 días desde el inicio de la promoción y pregunta si está
  seguro de matricular al alumno de todas formas — la matrícula solo continúa si confirma.
  Aplica igual para ambos roles (no es un permiso exclusivo de admin).
- **AC6**: Given que un rango de promoción (start_date, ~5 semanas) contiene N feriados
  (L-S), When se calcula la fecha de término (automática o manual), Then `end_date` se
  extiende N días hábiles (L-S, saltando domingos) más allá del sábado de la 5ª semana, de
  forma que la promoción siempre complete 30 clases reales no-feriado. Si algún día de la
  extensión también cae en feriado, se sigue extendiendo hasta completar el total. Aplica
  igual a la creación automática (Edge Function) y a la creación manual
  (`admin-promocion-crear-drawer.component.ts` / `crearPromocion()` — comportamiento actual
  corregido como parte de esta spec, no es fix aparte).

### Edge cases obligatorios

- **AC-E1**: Given que el cron/trigger de creación automática corre más de una vez sin que
  haya pasado una nueva cadencia de 14 días, When se ejecuta, Then no debe crear promociones
  duplicadas para el mismo `start_date`.
- **AC-E2**: Given que 2 o más feriados caen en fechas consecutivas de días hábiles cerca del
  final del rango extendido, When se recalcula `end_date`, Then el algoritmo sigue extendiendo
  sin loop infinito ni error hasta completar las 30 clases (verificado con test unitario de
  feriados consecutivos, no solo un feriado aislado).

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Convalidaciones (fecha de inicio derivada del padre vs. caso a caso) — bloqueado,
  pregunta pendiente al cliente. Ver `specs/assignments/ASG-035-promociones-cadencia-automatica.md`.
- ❌ Eliminar o deprecar el botón "Programar Promoción" (creación manual, `crearPromocion()`
  en `AdminProfesionalPromocionesComponent`). Decisión explícita del owner: se mantiene tal
  cual, como fallback para lunes que el cron no contemple (ej. feriado, ajuste puntual). Esta
  spec solo agrega la creación automática — no reemplaza la manual.
- ❌ Numeración de `code` por sede — confirmado con el owner que Clase Profesional solo opera
  en una sede (Conductores Chillán) y eso no va a cambiar. La secuencia es global.
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
- **Edge Function programada** (no trigger SQL puro) que garantice la existencia de la
  promoción del próximo lunes según la cadencia de 14 días, capaz de hacer `fetch()` a la API
  de feriados (`apis.digital.gob.cl/fl/feriados/{año}`) y aplicar `cancelHolidaySessions()`
  sobre las sesiones generadas, igual que hoy hace `promociones.facade.ts:crearPromocion()`
  desde el navegador. Precedente relevante: este proyecto ya descartó `pg_net` para llamadas
  HTTP desde SQL puro (ver ASG-046 / spec 0027).
- Selector de promoción en el wizard de matrícula Profesional capaz de listar varias
  promociones activas simultáneamente.
- Validación de matrícula tardía con modal de confirmación pasado el día 3 (advertencia
  salvable, no bloqueo duro), disponible para admin y secretaria por igual.

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

**Hallazgo (verificado en código, 2026-07-28):** `class_book` hoy se crea de forma **perezosa**,
no al crear la promoción. Los únicos 2 puntos de creación son:
  1. `libro-de-clases.facade.ts:saveClassBookFields()` — `INSERT` solo si se guardan los
     campos editables (Código SENCE / Horario) desde la vista Libro de Clases.
  2. `generate-class-book-pdf` (Edge Function) — `upsert` con `onConflict:
     'promotion_course_id'` al exportar el PDF por primera vez.

  Si nadie entra nunca a esa vista para una promoción/curso dado, **el `class_book` nunca
  existe** — la migración `20260405100000` fue solo un backfill retroactivo de una vez, no
  cerró el hueco hacia adelante. Como el cliente pidió explícitamente que "puedan haber libros
  de clases sin ningún estudiante" (es decir, que el libro exista igual aunque esté vacío), la
  automatización de creación de promociones **debe crear el `class_book` de cada
  `promotion_course` en el mismo momento**, sin depender de que alguien entre a esa pantalla.

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): wizard de matrícula Profesional (paso de selección de
  promoción/curso).
- Flujo principal (happy path): la secretaria abre el wizard, ve la lista de promociones
  activas (puede haber 2), elige la correspondiente, continúa la matrícula normal.
- Estados especiales: promoción recién creada sin alumnos (debe listarse igual si está
  vigente); matrícula tardía → modal de confirmación explícito ("han pasado más de 3 días
  desde que inició esta promoción, ¿deseas matricular al alumno de todas formas?") al intentar
  matricular en una promoción con más de 3 días desde `start_date`. Mismo modal para admin y
  secretaria.

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- Cero promociones creadas manualmente después del despliegue.
- Cero huecos de calendario (semanas sin promoción vigente cuando debería haber una).

---

## 9. Notas / decisiones abiertas

- [x] Matrícula tardía pasado el día 3: es advertencia salvable vía modal de confirmación,
  no bloqueo duro — confirmado por Matías (owner) el 2026-07-28. Aplica igual a admin y
  secretaria. Ver AC5.
- [x] Cadencia de promociones (14 días) y solapamiento — confirmado por Matías (owner) el
  2026-07-28, ya no es una pregunta abierta. `indices/DATABASE.md` actualizado.
- [x] Botón manual "Programar Promoción" se mantiene sin cambios — decisión del owner, fallback
  para lunes fuera del cron.
- [x] Auto-asignación de `code` (AC1b) — secuencia global (última + 1), confirmado que Clase
  Profesional solo opera en 1 sede y eso no cambiará.
- [x] Días de clase L-S, 5 semanas / 30 clases por promoción — confirmado por Matías (owner)
  el 2026-08-06. No era bug; fija cómo se calcula `end_date` en la creación automática.
- [x] Feriados en la automatización — Edge Function programada (no trigger SQL puro),
  confirmado por Matías (owner) el 2026-08-06.
- Convalidaciones quedan fuera de esta spec (ver sección 4) hasta que el cliente responda.
- Originado de Asignación ASG-035 (specs/assignments/ASG-035-promociones-cadencia-automatica.md)

---

## Changelog

- 2026-07-28 — draft inicial por m, a partir de ASG-035.
- 2026-07-28 — aprobada. Resuelto AC5 (matrícula tardía = advertencia salvable vía modal,
  no bloqueo duro, mismo comportamiento para admin y secretaria) con decisión del owner.
- 2026-07-28 — corregida sección 6: el owner detectó que `class_book` se crea de forma
  perezosa (al guardar campos editables o exportar PDF), no en un punto único — se verificó
  en código y se documentó en sección 6. La automatización debe crear el `class_book`
  explícitamente, no asumir que ya existe.
- 2026-07-28 — agregado AC1b (auto-asignación de `code` secuencial global, mismo formato que
  `propagateCodeToCourses()`) y aclarado en sección 4 que el botón manual "Programar
  Promoción" se mantiene sin cambios como fallback. Ambos por decisión explícita del owner.
- 2026-08-06 — desbloqueada: confirmado L-S / 5 semanas / 30 clases por promoción, y que la
  automatización se implementa como Edge Function programada (no trigger SQL puro) para poder
  hacer fetch a la API de feriados. Status pasa de `blocked` a `ready`.
- 2026-08-07 — agregado US5/AC6/AC-E2 (owner): los feriados dentro del rango ya no solo se
  cancelan, `end_date` se extiende para recuperar las clases perdidas y completar siempre 30
  clases reales. Confirmado que esto corrige también la creación MANUAL existente
  (`crearPromocion()` hoy solo cancela, no recupera) — el fix queda dentro del alcance de esta
  spec, no como track aparte, por decisión explícita del owner.
