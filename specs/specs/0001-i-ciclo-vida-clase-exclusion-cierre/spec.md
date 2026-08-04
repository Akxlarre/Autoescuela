# Spec 0001-i — Ciclo de vida de la clase: exclusión mutua, cierre automático y aviso

> **Status:** draft
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

**Respuestas del cliente (2026-08-02):**
1. **Umbral de "clase abierta mucho rato":** 15 minutos de retraso sin cerrarse. El aviso es
   visual en el dashboard donde se muestra "inicio de clase": cambia de color/estado la sesión
   en cuestión (no se especificó notificación adicional a secretaría/instructor más allá de ese
   cambio visual — confirmar con capa 2 de notificaciones solo si se pide explícitamente).
2. **Sin geocerca GPS.** No se exige volver a la sede. En su lugar: exclusión mutua dura — el
   dashboard puede mostrar la próxima clase agendada justo después de la actual, pero no
   permite iniciarla (`startClass()` debe rechazar) si la clase anterior del mismo instructor
   sigue sin cerrarse (`status='in_progress'`).

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
- **US3**: Como Secretaria/Admin, quiero que las clases que quedaron abiertas sin cerrar se
  resuelvan automáticamente a fin de jornada, para que no contaminen horas del instructor ni
  KPIs de "clases en curso" indefinidamente.
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
- **AC4**: Given una sesión `in_progress` al final de la jornada que nunca se cerró
  manualmente, When corre el proceso de cierre automático, Then la sesión pasa a un estado
  terminal marcado explícitamente como "cerrada automáticamente" (no se confunde con un cierre
  manual normal) y no cuenta como clase dictada con evidencia para `recalc_instructor_monthly_hours()`.
- **AC5**: Given una sesión ya cerrada (`completed`/`no_show`/cancelada) del mismo instructor,
  When intenta iniciar la siguiente sesión agendada, Then `startClass()` lo permite sin
  restricción.

### Edge cases obligatorios

- **AC-E1**: Given que el proceso de cierre automático corre más de una vez sobre la misma
  sesión ya resuelta, When se ejecuta, Then no debe re-procesarla ni duplicar efectos (horas,
  notificaciones).
- **AC-E2**: Given un instructor con clases en dos sedes distintas el mismo día (si el modelo lo
  permite), When evalúa la exclusión mutua, Then el criterio de "sesión abierta" es por
  instructor global, no por sede — confirmar contra el modelo de datos real en `plan.md`.

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Geocerca GPS / validar que el instructor volvió físicamente a la sede — descartado
  explícitamente por el cliente (respuesta 2, 2026-08-02).
- ❌ Notificación persistente (capa 2, `NotificationsFacade`) por clase abierta mucho rato — el
  cliente pidió solo aviso visual en vivo. Si se decide ampliar, es una spec/fix aparte.
- ❌ ASG-b-010 (Portal Instructor corriendo sobre `useMock=true` hardcodeado en
  `instructor-clases.facade.ts:53`) — la Asignación original marca solape y sugiere resolver
  ASG-b-010 primero o tomarlas juntas. Se deja fuera de este scope; ver sección 5.
- ❌ ASG-b-044 (alerta a secretaría cuando el instructor cierra una clase manualmente) — ya
  implementada en `fix-091-m-alerta-secretaria-cierre-clase` /
  `fix-092-m-deeplink-secretaria-notif-class-b`. Esta spec puede reutilizar el mismo patrón de
  notificación para el cierre automático (ver Asignación, nota 2026-08-01), pero no modifica lo
  ya cerrado.

---

## 5. Dependencias

### Specs previas
- Ninguna directa.

### Capacidades del proyecto que se asumen existentes
- `mark_end_of_day_class_b_absences()` (pg_cron `0 1 * * *`) — punto de referencia para el
  nuevo proceso de cierre automático (mismo patrón de cron, alcance distinto: hoy solo cubre
  `scheduled`).
- `notify_class_b_completed()` (`supabase/migrations/20260801100000_...`) — patrón de
  notificación a secretarias reutilizable para el aviso de cierre automático.
- `SessionStatus` (`src/app/core/utils/schedule-status.utils.ts`) —
  `'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'`.

### Riesgo de solape (no bloqueante, coordinar)
- ⚠️ **ASG-b-010**: `instructor-clases.facade.ts` tiene `useMock=true` hardcodeado (línea 53).
  No tiene sentido validar exclusión mutua real contra la rama mock. Confirmar con el owner de
  ASG-b-010 antes de implementar, o resolver esa asignación primero.

### Capacidades nuevas requeridas
- Validación de exclusión mutua en `startClass()` — preferir constraint/trigger en BD sobre
  validación solo en el cliente (el Facade no es el único camino a la tabla).
- Extensión/nuevo cron para cierre automático de sesiones `in_progress` olvidadas a fin de
  jornada.
- Lógica de "15 minutos de retraso" para el aviso visual (puede ser computado en el cliente a
  partir de la hora de inicio agendada, o precomputado — decidir en `plan.md`).

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas existentes involucradas: `class_b_sessions`.
- Tablas/columnas nuevas: por definir en `plan.md`. Probablemente se necesita distinguir
  "cerrada automáticamente" de un cierre manual normal (¿columna `auto_closed: boolean`? ¿un
  estado terminal nuevo?) — pendiente de decisión técnica, no bloquea la spec pero sí el AC4.
- RLS: reutilizar policies existentes de `class_b_sessions` — el cron/trigger corre con rol de
  servicio.

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): dashboard de "inicio de clase" (instructor), posiblemente vista de
  agenda/dashboard de secretaría si se decide reflejar el aviso ahí también.
- Flujo principal: instructor intenta iniciar una clase nueva mientras tiene otra
  `in_progress` → botón de inicio deshabilitado o acción rechazada con mensaje claro. El
  dashboard puede seguir mostrando la próxima clase agendada.
- Estado especial: sesión `in_progress` que supera los 15 minutos → cambio visual de
  color/estado en la tarjeta/fila de esa sesión.

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- Cero sesiones `in_progress` que persistan más de 1 día de jornada sin resolver.
- Cero instructores con 2+ sesiones `in_progress` simultáneas.

---

## 9. Notas / decisiones abiertas

- [ ] Definir el estado terminal exacto para el cierre automático (AC4): ¿`completed` +
  columna/flag, o un estado nuevo? Afecta a `recalc_instructor_monthly_hours()` y a cualquier
  reporte que cuente `completed` como "clase dictada con evidencia".
- [ ] Confirmar si el criterio de exclusión mutua (AC-E2) es por instructor global o por sede,
  contra el modelo real de `class_b_sessions` / multi-sede de instructores.
- [ ] Coordinar con ASG-b-010 (useMock hardcodeado) antes de implementar — ver sección 5.
- Originado de Asignación ASG-b-036 (specs/assignments/ASG-b-036-ciclo-vida-clase-exclusion-cierre.md).

---

## Changelog

- 2026-08-04 — draft inicial por i, a partir de ASG-b-036 (reclamada vía /assign-claim).
