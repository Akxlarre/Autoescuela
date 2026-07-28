# Asignación ASG-036 — Ciclo de vida de la clase: exclusión mutua, cierre automático y aviso

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** spec
> **priority:** P1
> **created:** 2026-07-28
> **created_by:** b
> **bloqueada_por:** respuesta del cliente (ver "Preguntas abiertas")

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

## Preguntas abiertas (BLOQUEANTE — preguntar al cliente antes de codear)

1. **"Clase abierta mucho rato" = ¿cuántos minutos?** La clase dura 45 min por defecto
   (`duration_min`). ¿Se avisa a los 90 min, a las 2 horas? **¿Y a quién se le avisa** —
   ¿al instructor, a la secretaría de la sede, a ambos?
2. **¿El sistema debe EXIGIR volver a la sede entre la clase 1 y la 2, o alcanza con impedir
   dos clases abiertas a la vez?** Las columnas `gps_start` y `gps_end` ya existen en
   `class_b_sessions` pero están **sin usar**, así que la geocerca es técnicamente posible.
   ⚠️ **Esta respuesta define si esto es un fix chico o una spec grande.** Con geocerca entran
   permisos de ubicación en el navegador, radio de tolerancia y un plan B para cuando el GPS
   falle o el instructor niegue el permiso. No se puede estimar la tarea sin esta respuesta.

## Alcance sugerido

Una vez respondidas las preguntas, el núcleo es:

- **Exclusión mutua**: impedir `startClass()` si el instructor ya tiene una sesión
  `in_progress`. Preferir constraint/trigger en BD sobre validación solo en el cliente — el
  Facade no es el único camino a la tabla.
- **Cierre automático**: extender el cron para que las sesiones `in_progress` olvidadas se
  resuelvan a fin de jornada. Definir a qué estado van (¿`completed` con marca de "cerrada
  automáticamente"? ¿un estado nuevo?) — no deberían contar como clase dictada sin evidencia.
- **Aviso** de clase abierta mucho rato (capa 2 del sistema de notificaciones, ver
  `.claude/rules/notifications.md`).

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

- ⚠️ **Se solapa con ASG-010** (Portal Instructor corriendo sobre `useMock=true` hardcodeado
  en este mismo archivo, línea 53). Coordinar: no tiene sentido validar exclusión mutua contra
  la rama mock. Idealmente ASG-010 se cierra primero, o se toman juntas.
- Antes de agregar el constraint, revisar si hay filas `in_progress` viejas en producción que
  lo violarían — es muy probable que sí, dado que nunca se cerraron solas.
