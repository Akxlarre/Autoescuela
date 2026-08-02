# Fix: Botón "Recordar" del rail de alertas de Asistencia B no envía nada + UX de los botones de alerta
> id: fix-093-b-boton-recordar-alertas-asistencia-b
> refs: ASG-b-059
> status: in_progress
> created: 2026-08-01

## Root Cause

**[Heredado de ASG-b-059, a confirmar]:** En el rail de alertas de **Asistencia Clase B**, el
botón **"Recordar"** (alumnos con faltas, nivel `warning`) no hace absolutamente nada:
`AsistenciaClaseBFacade.sendReminder()` descarta su parámetro (`void enrollmentId;`) y solo
muestra un toast que afirma `'Recordatorio enviado al alumno'`. No inserta en `notifications`,
no toca la BD, no le llega nada al alumno. Sus hermanos de la misma fila (`removeSchedule`,
`reactivateSchedule`) sí escriben en `class_b_sessions` — este quedó como stub.

El objetivo es doble: **(1)** que "Recordar" haga algo real (o, si no se puede, que deje de
mentir), y **(2)** cerrar los problemas de UX del grupo de botones de ese rail, que fue lo
que hizo sospechar del bug en primer lugar — al apretar no cambia nada en pantalla, así que
uno no sabe si funcionó y vuelve a apretar.

### Verificado al reclamar (no heredado)

- `NotificationsFacade.createNotification()` existe y funciona (`notifications.facade.ts:184`).
- **R1 del mapa de notificaciones no bloquea:** la RLS de INSERT en `notifications` permite solo
  `admin`/`secretary` desde el cliente, y esta pantalla la consumen exactamente
  `features/admin/asistencia` y `features/secretaria/asistencia` — nadie más. No hace falta
  Edge Function ni trigger SQL.
- El principio de diseño de `indices/NOTIFICATIONS-MAP.md` respalda notificar acá: "solo se
  justifica notificación cuando el destinatario NO vive en el dashboard" → el destinatario es
  el alumno. No es espejar una alerta de Capa 3.
- `reference_type: 'class_b'` ya existe y ya tiene deep-link resuelto (R5, spec 0024). Cero
  modelo nuevo.
- `sendReminder` tiene **0 cobertura** en `asistencia-clase-b.facade.spec.ts` (el archivo existe).

## ACs Afectados

Ninguno — fix autónomo. La spec 0030 cubrió el *layout* de este rail, no el comportamiento de
sus botones; su contrato sigue intacto y no debe rediseñarse el layout acá.

## Cambio

- **Archivo:** `src/app/core/facades/asistencia-clase-b.facade.ts`
- **Qué cambia:** `sendReminder()` deja de ser stub — resuelve `enrollment → student_id → users.id`
  y crea la notificación in-app vía `NotificationsFacade`; setea `_isSaving`; el toast solo
  afirma el envío si el insert salió bien.

- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
- **Qué cambia:** estado de proceso por fila (`enrollmentId`) en vez del `isSaving()` global que
  bloquea todas las alertas; confirmación en "Eliminar" vía `ConfirmModalService` y baja de su
  peso visual (hoy `btn-primary` para la acción destructiva).

- **Archivo:** `src/app/core/facades/asistencia-clase-b.facade.spec.ts`
- **Qué cambia:** tests de `sendReminder` (hoy 0 cobertura) — TDD: escribir primero.

## Test de Regresión

- `asistencia-clase-b.facade.spec.ts > sendReminder crea la notificación con el users.id del alumno (no students.id)` ✓
- `asistencia-clase-b.facade.spec.ts > sendReminder NO muestra toast de éxito si el insert falla` ✓
- `asistencia-clase-b.facade.spec.ts > sendReminder marca y limpia _isSaving` ✓

## Decisión de negocio pendiente (no bloquea el arranque)

Qué significa "Recordar" para el cliente: (a) notificación in-app; (b) + registro persistido para
mostrar "último recordatorio: fecha" y evitar spam; (c) correo/WhatsApp — **no existe hoy**, sería
spec aparte.

**Piso mínimo acordado con el owner (2026-08-01):** implementar (a) + que el toast diga la verdad.
No se contradice con lo que el cliente responda después. Si la respuesta llega y pide (b), se
amplía en este mismo fix; si pide (c), sale como spec nueva.

**Regla innegociable:** ningún toast de éxito puede afirmar una acción que no ocurrió.

## Notas

- Originado de Asignación ASG-b-059 (`specs/assignments/ASG-b-059-boton-recordar-alertas-asistencia-b.md`).
- `ASG-b-008` (completada, `fix-086-m-btn-sm-arch16-restante`) ya tocó este mismo componente y fijó
  el canon de `btn-sm` — consultarlo antes de cambiar la jerarquía de los botones, para no
  contradecir esa decisión.
- Barrer si hay otros stubs del mismo tipo en el módulo antes de cerrar (este apareció por
  casualidad al revisar el rail, no por una búsqueda sistemática).
