# Asignación ASG-b-036 — Ciclo de vida de la clase: exclusión mutua, cierre automático y aviso

> **status:** reclamada
> **owner:** i
> **tipo_sugerido:** spec
> **priority:** P1
> **created:** 2026-07-28
> **created_by:** b
> **claimed_by:** i
> **claimed_at:** 2026-08-04
> **resulting_track:** 0001-i-ciclo-vida-clase-exclusion-cierre

---

## Contexto / Objetivo

Agrupa 4 anotaciones de la reunión (2026-07-28) que resultaron ser **el mismo defecto** visto
desde 4 ángulos:

1. *"Que no se puedan Iniciar Clases distintas al mismo tiempo para un mismo instructor."*
2. *"Poner avisos por si una clase lleva abierta mucho rato."*
3. *"Revisar si Clase se cierra sola, revisar estados y si es coherente."*
4. *"Cuando agendan 2 clases seguidas, deben volver a la sede después de la 1ra clase para
   finalizar la clase y empezar la siguiente. Revisar flujo para el inicio de más de una clase
   y revisar si existe un cierre automático de la clase."*

### Hallazgo verificado en código (no es hipótesis)

- **`src/app/core/facades/instructor-clases.facade.ts:192`** — `startClass()` hace un
  `UPDATE class_b_sessions SET status='in_progress'` **sin ninguna validación** de que el
  instructor no tenga ya otra clase abierta. Nada impide 2, 3 o N clases simultáneas.
- **`finishClass()` (línea 237)** es 100% manual: depende de que el instructor apriete
  "Finalizar".
- **El barrido nocturno NO cubre esto.** `mark_end_of_day_class_b_absences()` (pg_cron
  `0 1 * * *`) solo procesa filas en `status='scheduled'`. Una sesión en `in_progress`
  **no la mira nadie**: queda abierta indefinidamente, ni `completed` ni `no_show`.

O sea: la respuesta a la anotación 3 es **no, la clase no se cierra sola, y además el barrido
existente la ignora**. Eso contamina las horas del instructor (`recalc_instructor_monthly_hours`
solo cuenta `completed`), el avance del alumno y los KPIs de "clases en curso".

## Respuestas del cliente (2026-08-02)

1. **Umbral de "clase abierta mucho rato":** 15 minutos de retraso sin cerrarse. El aviso es
   visual en el dashboard donde se muestra "inicio de clase": cambia de color/estado la sesión
   en cuestión (no se especificó notificación adicional a secretaría/instructor más allá de ese
   cambio visual — confirmar con capa 2 de notificaciones solo si se pide explícitamente).
2. **Sin geocerca GPS.** No se exige volver a la sede. En su lugar: exclusión mutua dura —
   el dashboard puede **mostrar** la próxima clase agendada justo después de la actual, pero
   **no permite iniciarla** (`startClass()` debe rechazar) si la clase anterior del mismo
   instructor sigue sin cerrarse (`status='in_progress'`).

## Alcance sugerido

Con las respuestas ya incorporadas, el núcleo es:

- **Exclusión mutua**: impedir `startClass()` si el instructor ya tiene una sesión
  `in_progress`. Preferir constraint/trigger en BD sobre validación solo en el cliente — el
  Facade no es el único camino a la tabla.
- **Cierre automático**: extender el cron para que las sesiones `in_progress` olvidadas se
  resuelvan a fin de jornada. Definir a qué estado van (¿`completed` con marca de "cerrada
  automáticamente"? ¿un estado nuevo?) — no deberían contar como clase dictada sin evidencia.
- **Aviso** de clase abierta mucho rato (15 min): cambio visual de color/estado en el dashboard
  de "inicio de clase" sobre la sesión afectada. No requiere capa 2 (notificación persistente)
  salvo que se decida ampliarlo al implementar — el requisito del cliente es visual en vivo.
- **Bloqueo de inicio**: `startClass()` debe rechazar si el instructor ya tiene una sesión
  `in_progress`. El dashboard puede seguir mostrando la próxima clase agendada, pero su botón de
  inicio queda deshabilitado hasta que la anterior se cierre.

## Referencias

- `src/app/core/facades/instructor-clases.facade.ts:192` (startClass), `:237` (finishClass)
- `indices/DATABASE.md` → `mark_end_of_day_class_b_absences()`,
  `recalc_instructor_monthly_hours()`, tabla `class_b_sessions`
- `src/app/core/utils/schedule-status.utils.ts` — `SessionStatus` es
  `'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'`

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/instructor-clases.facade.ts`
- `supabase/migrations/` (constraint + ajuste al cron)

## Notas para quien la reclame

- ⚠️ **Se solapa con ASG-b-010** (Portal Instructor corriendo sobre `useMock=true` hardcodeado
  en este mismo archivo, línea 53). Coordinar: no tiene sentido validar exclusión mutua contra
  la rama mock. Idealmente ASG-b-010 se cierra primero, o se toman juntas.
- Antes de agregar el constraint, revisar si hay filas `in_progress` viejas en producción que
  lo violarían — es muy probable que sí, dado que nunca se cerraron solas.

### Nota (2026-08-01) — ya existe un aviso de cierre MANUAL, reutilizable pero fuera de alcance

Esto **no forma parte del alcance de ASG-b-036** (que es sobre el aviso de **cierre
automático**, aún sin implementar). Se deja como referencia porque quien tome esta asignación
va a necesitar un patrón de notificación a secretaría y ya existe uno para el caso manual.

`ASG-b-044` (alerta a secretaría cuando un instructor cierra una clase manualmente — tarea
distinta, solo mencionada arriba como solape) se implementó en
**fix-091-m-alerta-secretaria-cierre-clase** + **fix-092-m-deeplink-secretaria-notif-class-b**:
`notify_class_b_completed()` (`supabase/migrations/20260801100000_...`) notifica a
**todas las secretarias de la sede** cada vez que una clase pasa a `completed` vía
`finishClass()` (cierre manual del instructor). El deep-link de esa notificación en el topbar
lleva a `/app/secretaria/agenda`.

**Todo el alcance original de esta asignación sigue sin tocar:**
- No hay nada que dispare aviso cuando una clase queda `in_progress` sin cerrar — el trigger
  de `notify_class_b_completed()` solo escucha la transición **a** `completed`, y hoy nada
  fuerza esa transición si el instructor nunca aprieta "Finalizar" (ver Hallazgo verificado
  arriba).
- No hay exclusión mutua ni cierre automático.

**Al implementar el aviso de cierre automático de esta asignación:** evaluar si conviene
reutilizar el mismo patrón que `notify_class_b_completed()` (el bloque `FOR ... LOOP` sobre
secretarias de la sede es reutilizable tal cual), con texto que distinga "cerrada por el
instructor" de "cerrada automáticamente por el sistema".
