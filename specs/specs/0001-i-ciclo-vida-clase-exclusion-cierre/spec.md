# Spec 0001-i — Ciclo de vida de la clase: exclusión mutua y aviso de cierre atrasado

> **Status:** done
> **Created:** 2026-08-04
> **Owner:** i
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Asignación ASG-b-036 (`specs/assignments/ASG-b-036-ciclo-vida-clase-exclusion-cierre.md`),
originada en la reunión con el cliente del 2026-07-28.

**Persona afectada:** Instructor (inicio/cierre de clases Clase B), Secretaria/Admin (dashboard
de "inicio de clase", horas del instructor, KPIs de clases en curso).

**Problema que resuelve:**
Agrupa 4 anotaciones de la reunión (2026-07-28) que resultaron ser el mismo defecto visto desde
4 ángulos:

1. "Que no se puedan Iniciar Clases distintas al mismo tiempo para un mismo instructor."
2. "Poner avisos por si una clase lleva abierta mucho rato."
3. "Revisar si Clase se cierra sola, revisar estados y si es coherente."
4. "Cuando agendan 2 clases seguidas, deben volver a la sede después de la 1ra clase para
   finalizar la clase y empezar la siguiente. Revisar flujo para el inicio de más de una clase
   y revisar si existe un cierre automático de la clase."

**Hallazgo verificado en código (no es hipótesis):**
- `src/app/core/facades/instructor-clases.facade.ts:192` — `startClass()` hace un
  `UPDATE class_b_sessions SET status='in_progress'` sin ninguna validación de que el
  instructor no tenga ya otra clase abierta. Nada impide 2, 3 o N clases simultáneas.
- `finishClass()` (línea 237) es 100% manual: depende de que el instructor apriete "Finalizar".
- El barrido nocturno NO cubre esto. `mark_end_of_day_class_b_absences()` (pg_cron `0 1 * * *`)
  solo procesa filas en `status='scheduled'`. Una sesión en `in_progress` no la mira nadie:
  queda abierta indefinidamente, ni `completed` ni `no_show`.

O sea: la respuesta a la anotación 3 es no, la clase no se cierra sola, y además el barrido
existente la ignora. Eso contamina las horas del instructor
(`recalc_instructor_monthly_hours` solo cuenta `completed`), el avance del alumno y los KPIs de
"clases en curso".

**Respuestas del cliente (2026-08-02, confirmadas y ampliadas el 2026-08-04):**
1. **No existe cierre automático a un estado terminal.** La clase SIEMPRE la cierra un humano
   (el instructor apretando "Finalizar"). Lo único automático es el **aviso**: pasados 15
   minutos desde la hora de inicio sin que la sesión se haya cerrado, el dashboard donde se
   muestra "inicio de clase" cambia de color/estado en esa sesión puntual, para que
   secretaría/admin note visualmente que el cierre está atrasado. No hay notificación
   persistente adicional (capa 2) salvo que se pida explícitamente más adelante.
2. **Sin geocerca GPS.** No se exige volver a la sede. En su lugar: exclusión mutua dura, pero
   **solo sobre la acción de iniciar, no sobre la visibilidad**. Ejemplo real del cliente: la
   secretaria puede ver en el dashboard la clase A (que debía cerrar a las 15:00) y la clase B
   (que arranca a las 15:00) al mismo tiempo, incluso si ya son las 15:05 y A sigue abierta —
   ambas se muestran. Lo que se bloquea es que el instructor **inicie** B mientras A siga
   `in_progress`: `startClass()` debe rechazar la acción hasta que A se cierre.
3. **ASG-b-010 (Portal Instructor sobre datos mock) ya está completada** (fix-001-i, cerrada
   2026-07-29, `useMock = false` en producción) — el riesgo de solape mencionado originalmente
   ya no aplica, se puede implementar y probar contra datos reales sin coordinación adicional.

**Hipótesis de valor:**
Cierra un hueco real de integridad de datos (clases que quedan `in_progress` para siempre,
contaminando horas/KPIs) y da al instructor/secretaría visibilidad de clases estancadas sin
depender de que alguien note el problema manualmente.

---

## 2. User Stories

- **US1**: Como Instructor, no quiero poder iniciar una clase nueva si todavía tengo una clase
  `in_progress` sin cerrar, para no generar sesiones simultáneas inconsistentes.
- **US2**: Como Secretaria/Admin, quiero ver un aviso visual en el dashboard cuando una clase
  lleva más de 15 minutos abierta sin cerrarse, para poder intervenir si hace falta.
- **US3**: Como Secretaria/Admin, quiero ver ambas clases (la que sigue abierta y la que ya
  debería empezar) al mismo tiempo en el dashboard, aunque no se pueda iniciar la segunda
  todavía, para tener visibilidad completa del día del instructor.
- **US4**: Como Instructor, quiero seguir viendo mi próxima clase agendada aunque la actual siga
  abierta, aunque no pueda iniciarla todavía, para saber qué sigue en mi día.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check manual
> reproducible, el AC está mal formulado.

- **AC1**: Given un instructor con una sesión `class_b_sessions` en `status='in_progress'`,
  When intenta iniciar (`startClass()`) otra sesión propia, Then el sistema rechaza la acción
  y no cambia el status de la nueva sesión.
- **AC2**: Given un instructor sin ninguna sesión `in_progress`, When inicia una clase
  agendada, Then `startClass()` funciona igual que hoy (sin regresión).
- **AC3**: Given una sesión `in_progress` que superó los 15 minutos desde su hora de inicio sin
  cerrarse, When se consulta el dashboard de "inicio de clase", Then esa sesión se muestra con
  un color/estado distinto al de una sesión `in_progress` recién iniciada.
- **AC4**: Given que el instructor tiene la clase A `in_progress` (por ejemplo, debía cerrar a
  las 15:00) y la clase B agendada a las 15:00 con el mismo instructor, When se consulta el
  dashboard a las 15:05, Then ambas sesiones (A y B) se muestran normalmente — la visibilidad
  no se restringe, solo la acción de iniciar B (ver AC1).
- **AC5**: Given una sesión ya cerrada manualmente (`completed`/`no_show`/cancelada) del mismo
  instructor, When intenta iniciar la siguiente sesión agendada, Then `startClass()` lo permite
  sin restricción.

### Edge cases obligatorios

- **AC-E1**: Given un instructor con clases en dos sedes distintas el mismo día (si el modelo lo
  permite), When evalúa la exclusión mutua, Then el criterio de "sesión abierta" es por
  instructor global (no por sede) — un instructor es una sola persona física, no puede estar
  dictando dos clases a la vez sin importar la sede.
- **AC-E2**: Given una sesión `in_progress` que ya pasó los 15 minutos y se muestra en aviso
  visual, When el instructor finalmente la cierra manualmente, Then el aviso desaparece de
  inmediato (no queda una sesión `completed` marcada como atrasada).

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Geocerca GPS / validar que el instructor volvió físicamente a la sede — descartado
  explícitamente por el cliente (respuesta 2, 2026-08-02).
- ❌ Cierre automático a un estado terminal (`completed`, `no_show`, o cualquier otro) — el
  cliente confirmó el 2026-08-04 que la clase SIEMPRE la cierra un humano. No se crea ningún
  cron/trigger que cambie el `status` de una sesión `in_progress` sin acción del instructor.
- ❌ Notificación persistente (capa 2, `NotificationsFacade`) por clase abierta mucho rato — el
  cliente pidió solo aviso visual en vivo. Si se decide ampliar, es una spec/fix aparte.
- ❌ ASG-b-044 (alerta a secretaría cuando el instructor cierra una clase manualmente) — ya
  implementada en `fix-091-m-alerta-secretaria-cierre-clase` /
  `fix-092-m-deeplink-secretaria-notif-class-b`. No se modifica.

---

## 5. Dependencias

### Specs previas
- Ninguna directa.

### Capacidades del proyecto que se asumen existentes
- `SessionStatus` (`src/app/core/utils/schedule-status.utils.ts`) —
  `'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'`.
- ASG-b-010 ya resuelta (`useMock = false`) — sin riesgo de solape ni bloqueo, ver sección 1.

### Capacidades nuevas requeridas
- Validación de exclusión mutua en `startClass()` — preferir constraint/trigger en BD sobre
  validación solo en el cliente (el Facade no es el único camino a la tabla).
- Lógica de "15 minutos de retraso" para el aviso visual — puramente de lectura/presentación,
  computable en el cliente a partir de la hora de inicio agendada vs. hora actual (no requiere
  cron ni cambio de estado en BD).

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas existentes involucradas: `class_b_sessions`.
- Tablas/columnas nuevas: ninguna esperada — el aviso de 15 min es cálculo derivado (hora actual
  vs. hora de inicio agendada), no requiere persistir nada nuevo. La exclusión mutua se valida
  contra el `status` ya existente. A confirmar en `plan.md` si se implementa como constraint/
  trigger en BD o solo en el Facade.
- RLS: reutilizar policies existentes de `class_b_sessions` — sin cambios de superficie.

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): dashboard de "inicio de clase" (instructor y secretaría/admin).
- Flujo principal: instructor intenta iniciar una clase nueva mientras tiene otra
  `in_progress` → botón de inicio deshabilitado o acción rechazada con mensaje claro. El
  dashboard sigue mostrando ambas sesiones (la abierta y la siguiente agendada) sin ocultar
  ninguna.
- Estado especial: sesión `in_progress` que supera los 15 minutos desde su hora de inicio →
  cambio visual de color/estado en la tarjeta/fila de esa sesión puntual, hasta que se cierre
  manualmente.

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- Cero instructores con 2+ sesiones `in_progress` simultáneas.
- Toda sesión que supera los 15 minutos sin cerrar queda visualmente marcada en el dashboard
  hasta que un humano la cierre.

---

## 9. Notas / decisiones abiertas

- [x] No hay cierre automático a estado terminal — confirmado por el owner (i) el 2026-08-04.
  La clase siempre la cierra un humano; lo único automático es el aviso visual a los 15 min.
- [x] Exclusión mutua es por instructor global, con visibilidad sin restricción (AC-E1, AC4) —
  confirmado por el owner (i) el 2026-08-04, con ejemplo concreto de clase A/B superpuestas en
  el dashboard.
- [x] ASG-b-010 (useMock hardcodeado) ya resuelta — sin riesgo de solape.
- Originado de Asignación ASG-b-036 (specs/assignments/ASG-b-036-ciclo-vida-clase-exclusion-cierre.md).

---

## Changelog

- 2026-08-04 — draft inicial por i, a partir de ASG-b-036 (reclamada vía /assign-claim).
- 2026-08-04 — aclarado con el owner: no hay cierre automático a estado terminal (solo aviso
  visual a los 15 min), exclusión mutua es global por instructor y no oculta la visibilidad de
  clases en el dashboard, y ASG-b-010 ya está resuelta (sin riesgo de solape). Se simplifica el
  scope técnico (sin cron nuevo, sin columna/estado nuevo en BD).
