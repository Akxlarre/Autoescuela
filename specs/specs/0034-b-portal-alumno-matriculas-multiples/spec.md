# Spec 0034-b — Portal alumno no muestra matrículas múltiples

> **Status:** done
> **Created:** 2026-07-29
> **Owner:** b
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** ASG-b-033 (`specs/assignments/ASG-b-033-portal-alumno-matriculas-multiples.md`), hallazgo H-039 de `indices/FLOWS-QA-AUDIT.md`.

**Persona afectada:** Alumno (portal `/app/alumno/**`).

**Problema que resuelve:**
Cuando un alumno tiene 2+ matrículas activas (ej. Clase B con saldo pendiente + Profesional
pagada), la página "Pagos" del alumno solo muestra UNA matrícula — la que resuelve
`pickEnrollmentToShow()` en el Edge Function `student-payment` (fix-058, prioriza la que tiene
saldo real). La otra matrícula queda completamente invisible en esa página, aunque esté activa
y pagada. Encontrado y confirmado en vivo al verificar fix-058-b (H-039) con un alumno de
prueba con 2 matrículas reales — ese fix corrigió CUÁL matrícula se prioriza, pero no resuelve
que la otra quede oculta.

**Investigación (2026-07-29) — el alcance real es más chico de lo que sugería la Asignación:**
Dashboard, "Mis Clases" y "Mi Horario" del alumno **ya resolvieron este mismo problema** en
algún momento después de creada la Asignación (23-jul): los tres inyectan
`StudentEnrollmentContextFacade` (patrón compartido tipo `BranchFacade`: expone
`enrollments()`/`activeEnrollmentId()`/`setActive()`) y renderizan `<app-tabs>` cuando
`context.enrollments().length > 1`. Cada facade de página (ej. `StudentClasesFacade`) inyecta
ese contexto y lee `context.activeEnrollmentId()` internamente al hacer fetch. El KPI "Saldo"
del Dashboard ya muestra el saldo de la matrícula **seleccionada en el tab activo**, no un total
combinado.

La única página que falta es **"Pagos"** (`alumno-pagos.component.ts` /
`student-payment.facade.ts`), y su Edge Function (`supabase/functions/student-payment`,
acción `load-enrollment-status`) no acepta un `enrollmentId` — siempre delega en
`pickEnrollmentToShow()`. `initiate-payment` (misma Edge Function) sí acepta `enrollmentId` con
chequeo de ownership (`.eq('id', enrollmentId).eq('student_id', student.id)`) — ese es el
patrón de seguridad a replicar.

**Hipótesis de valor:**
El alumno con doble matrícula puede ver y gestionar su saldo/historial de pago de CADA una de
sus matrículas activas desde "Pagos", con el mismo patrón de tabs que ya usa el resto del
portal — sin inventar una UX nueva ni una regla de negocio distinta.

---

## 2. User Stories

- **US1**: Como alumno con 2+ matrículas activas, quiero ver un tab por cada matrícula en "Pagos" (igual que ya veo en Dashboard/Mis Clases/Mi Horario), para que ninguna quede oculta.
- **US2**: Como alumno con 2+ matrículas activas, quiero que el saldo pendiente y el historial de pagos mostrados correspondan a la matrícula del tab que tengo seleccionado, para no confundirme sobre cuánto debo en cada una.
- **US3**: Como alumno con una sola matrícula activa, quiero seguir viendo "Pagos" exactamente igual que hoy (sin tabs ni selectores superfluos), para que el caso común no se complique.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given un alumno autenticado con 2+ `enrollments` activos/completados, When navega a `/app/alumno/pagos`, Then ve un `<app-tabs>` con un tab por matrícula (mismo componente y variante que usa `alumno-dashboard.component.ts`), en vez de ver solo una matrícula.
- **AC2**: Given un alumno con 2+ matrículas, When hace click en un tab distinto al que estaba activo, Then el saldo pendiente, el historial de pagos y el step del wizard mostrados en pantalla corresponden EXCLUSIVAMENTE a la matrícula recién seleccionada (no a la que prioriza `pickEnrollmentToShow()`).
- **AC3**: Given un alumno con 2+ matrículas, When el Edge Function `student-payment` recibe `load-enrollment-status` con un `enrollmentId` que pertenece a otro alumno (IDOR), Then la respuesta es un error de autorización — mismo chequeo de ownership que ya aplica `initiate-payment`.
- **AC4**: Given un alumno con 2+ matrículas donde la seleccionada NO tiene saldo pendiente, When entra a su tab, Then puede ver su historial de pagos igual, sin que la UI fuerce el flujo de "pagar saldo" de otra matrícula.

### Edge cases obligatorios

- **AC-E1**: Given un alumno con **una sola** matrícula activa, When navega a "Pagos", Then NO se muestra ningún `<app-tabs>` ni selector — el comportamiento es idéntico al actual (sin regresión).
- **AC-E2**: Given un alumno con 2+ matrículas donde ninguna tiene saldo pendiente, When entra a "Pagos" por primera vez (sin haber elegido tab todavía), Then el tab activo por defecto es el mismo que hoy resuelve `pickEnrollmentToShow()` (prioriza saldo pendiente, si no hay ninguna cae a la más reciente) — no se cambia el default, solo se habilita poder cambiarlo.
- **AC-E3**: Given el Edge Function `student-payment` recibe `load-enrollment-status` **sin** `enrollmentId` en el body (compatibilidad hacia atrás), When se ejecuta, Then cae al comportamiento actual (`pickEnrollmentToShow()`) sin romper.

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Cambios a Dashboard, "Mis Clases" o "Mi Horario" del alumno — ya implementan el patrón correctamente (confirmado en la investigación), no se tocan.
- ❌ Vista combinada / saldo total agregado entre matrículas — se decidió seguir el precedente ya establecido en Dashboard (mostrar la matrícula seleccionada, no un total).
- ❌ Cambios al panel admin (`admin-alumno-detalle.component.ts`) o al wizard interno de matrícula (secretaría) — ya resueltos, fuera de esta spec.
- ❌ Rediseño visual o funcional de `<app-tabs>` — se reutiliza tal cual, sin modificar el componente compartido.
- ❌ Cambios al flujo de pago Webpay en sí (`initiate-payment`, `confirm-payment`) más allá de que `load-enrollment-status` reciba `enrollmentId` — la lógica de pago ya funciona por matrícula.

---

## 5. Dependencias

### Specs previas
- fix-058-b-pago-multiples-matriculas (`done`) — corrigió cuál matrícula se prioriza; esta spec resuelve que la otra quede oculta en "Pagos".

### Capacidades del proyecto que se asumen existentes
- `StudentEnrollmentContextFacade` (`core/facades/student-enrollment-context.facade.ts`) — ya usado por Dashboard/Clases/Horario, expone `enrollments()`, `activeEnrollmentId()`, `setActive(id)`.
- `<app-tabs>` (`shared/components/tabs/tabs.component.ts`) — componente compartido, variante `pill` usada en Dashboard.
- Patrón de wiring ya implementado en `StudentClasesFacade` (inyecta el contexto, lee `activeEnrollmentId()` en su método de fetch) — replicar el mismo patrón en `StudentPaymentFacade`.
- `initiate-payment` (Edge Function `student-payment`) — ya acepta `enrollmentId` con chequeo de ownership; `load-enrollment-status` debe replicar ese mismo chequeo.

### Capacidades nuevas requeridas
- `student-payment` Edge Function: `load-enrollment-status` acepta `enrollmentId` opcional en el body (con fallback a `pickEnrollmentToShow()` si no viene, AC-E3).
- `StudentPaymentFacade`: inyectar `StudentEnrollmentContextFacade`, pasar `activeEnrollmentId()` al fetch, re-fetchear al cambiar de tab (mismo patrón que `selectEnrollment()` en `alumno-clases.component.ts`).
- `AlumnoPagosComponent`: agregar el bloque de tabs (copiar el patrón exacto de `alumno-clases.component.ts` / `alumno-dashboard.component.ts`).

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas nuevas / modificadas: ninguna — el alumno ya puede tener N `enrollments` activos, es un problema de presentación + un parámetro faltante en un Edge Function, no de modelo de datos.
- Modelos UI nuevos: ninguno previsto — `EnrollmentTab` (de `student-home.model.ts`) ya existe y se reutiliza.
- RLS requerida: ninguna nueva — RLS de `enrollments` ya filtra por alumno dueño; el chequeo de ownership adicional en `load-enrollment-status` es a nivel de Edge Function (mismo patrón que `initiate-payment`), no de policy.

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): `/app/alumno/pagos` únicamente.
- Flujo principal (happy path): alumno con 2+ matrículas ve `<app-tabs variant="pill">` en la misma posición relativa que en Dashboard (bloque propio antes de las KPIs/contenido), cambia de tab → la página recarga (SWR, sin skeleton si ya había datos) el saldo/historial de la matrícula seleccionada.
- Estados especiales (loading, error, vacío): alumno con 1 sola matrícula no ve ningún tab (AC-E1); sin matrículas activas, comportamiento actual sin cambios (fuera de scope, no reportado como bug).

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- Cero reportes de "no veo mi otra matrícula" en la página de Pagos.

---

## 9. Notas / decisiones abiertas

Las 3 preguntas originales quedaron resueltas en la investigación del 2026-07-29 (ver §1):

- [x] ¿Tabs, selector o vista combinada? → **Tabs**, reutilizando `<app-tabs>` tal como ya lo hacen Dashboard/Clases/Horario. Sin decisión de diseño nueva.
- [x] ¿KPI de saldo combinado o por matrícula seleccionada? → **Por matrícula seleccionada** — sigue el precedente ya establecido en el Dashboard del alumno para el mismo dato.
- [x] ¿"Mis Clases"/"Mi Horario" ya manejan multi-matrícula? → **Sí, ya lo manejan** (implementado después de creada la Asignación). Fuera de scope de esta spec.

- Originado de Asignación ASG-b-033 (specs/assignments/ASG-b-033-portal-alumno-matriculas-multiples.md)

---

## Changelog

- 2026-07-29 — draft inicial por b
- 2026-07-29 — investigación de código confirma que Dashboard/Clases/Horario ya resolvieron el patrón; alcance acotado a la página "Pagos" + su Edge Function. ACs, dependencias y out-of-scope reescritos con hallazgos concretos.
