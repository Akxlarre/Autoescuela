# Asignación ASG-b-059 — Botón "Recordar" del rail de alertas no envía nada (stub que miente) + UX de los botones de alerta

> **status:** reclamada
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-07-31
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-08-01
> **resulting_track:** fix-093-b-boton-recordar-alertas-asistencia-b

---

## Contexto / Objetivo

En el rail de alertas de **Asistencia Clase B**, el botón **"Recordar"** (alumnos con
faltas, nivel `warning`) no hace absolutamente nada: `AsistenciaClaseBFacade.sendReminder()`
descarta su parámetro (`void enrollmentId;`) y solo muestra un toast que afirma
`'Recordatorio enviado al alumno'`. No inserta en `notifications`, no toca la BD, no le
llega nada al alumno. Sus hermanos de la misma fila (`removeSchedule`, `reactivateSchedule`)
sí escriben en `class_b_sessions` — este quedó como stub.

El objetivo es doble: **(1)** que "Recordar" haga algo real (o, si no se puede, que deje de
mentir), y **(2)** cerrar los problemas de UX del grupo de botones de ese rail, que fue lo
que hizo sospechar del bug en primer lugar — al apretar no cambia nada en pantalla, así que
uno no sabe si funcionó y vuelve a apretar.

## Alcance sugerido

- **Conectar `sendReminder` de verdad.** `NotificationsFacade.createNotification()` ya existe
  y funciona (`notifications.facade.ts:184`). Requiere resolver `enrollment → student_id → users.id`
  antes de notificar (patrón FK de siempre: `students.id ≠ users.id`).
- **Estado visible post-acción.** Hoy la alerta queda idéntica tras apretar. Mostrar "recordado
  el <fecha>" (o deshabilitar la acción un rato) para que la acción tenga consecuencia visible
  y no invite a re-apretar. Si se quiere persistir eso, hace falta decidir dónde se guarda.
- **`isSaving()` es global, no por fila.** Apretar "Eliminar" en un alumno deshabilita los
  botones de *todas* las alertas, sin indicar cuál se está procesando. Debería ser por
  `enrollmentId` (ver el patrón `_processing: Set<string>` de `alerts-drawer.component.ts:194`).
- **`sendReminder` nunca setea `_isSaving`**, así que el `[disabled]="isSaving()"` de ese botón
  es decorativo: no hay estado de carga aunque la acción pase a ser asíncrona.
- **"Eliminar" es destructivo, va con `btn-primary` y sin confirmación.** Cancela el horario
  completo del alumno de un clic. El proyecto ya tiene `ConfirmModalService`. Además la
  jerarquía visual está invertida: debería ser el botón de menor peso del grupo, no el más
  prominente.
- **Fuera de alcance (decisión de negocio pendiente):** si "Recordar" debe además mandar
  correo/WhatsApp. Eso **no existe hoy** en el sistema y no debe darse por incluido — ver Notas.

## Referencias

- `docs/BACKLOG-DEUDA-TECNICA.md` — deuda del DS (la parte de jerarquía de botones se toca acá).
- spec 0030 (`project_asistencia_b_layout_dual_spec0030`) — origen del rail lateral de alertas
  en 2 columnas; el layout está cerrado y **no** hay que rediseñarlo, solo los botones.
- Reglas de las 3 capas de feedback: `.claude/rules/notifications.md` (toast ≠ notificación).

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/asistencia-clase-b.facade.ts` (`sendReminder` ~línea 259, `removeSchedule` ~214, `reactivateSchedule` ~237)
- `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts` (rail de alertas, líneas ~250-290)
- `src/app/core/facades/notifications.facade.ts` (solo lectura — `createNotification`)
- `src/app/core/facades/asistencia-clase-b.facade.spec.ts`

## Notas para quien la reclame

- **Por qué P1 y no P2:** el problema no es un botón muerto, es que el sistema *afirma* haber
  avisado. La secretaria cree que le recordó a un alumno en riesgo de perder su horario y el
  alumno nunca se entera. Es pérdida de confianza en el feedback de la app.
- **Preguntar al negocio antes de implementar:** ¿qué significa "Recordar" para ellos?
  (a) notificación in-app al alumno — lo único 100% implementable hoy; (b) además dejar
  registro persistido para mostrar "último recordatorio: fecha" y evitar spam; (c) correo o
  WhatsApp — no existe en el sistema, sería una spec aparte, no parte de este fix.
  Si la respuesta tarda, la opción segura es (a) + que el toast diga la verdad.
- **Regla mínima innegociable, sin importar qué se decida:** ningún toast de éxito puede
  afirmar una acción que no ocurrió. Si al final se difiere el envío real, el fix igual debe
  quitar o corregir ese mensaje.
- Barrer si hay otros stubs del mismo tipo en el módulo antes de cerrar (este apareció por
  casualidad al revisar el rail, no por una búsqueda sistemática).
