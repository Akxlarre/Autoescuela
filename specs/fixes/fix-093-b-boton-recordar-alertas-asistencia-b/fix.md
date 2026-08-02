# Fix: Botón "Recordar" del rail de alertas de Asistencia B no envía nada + UX de los botones de alerta
> id: fix-093-b-boton-recordar-alertas-asistencia-b
> refs: ASG-b-059
> status: done
> closed: 2026-08-01
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
  peso visual (era `btn-primary` para la acción destructiva → `btn-danger-ghost`).

- **Archivos:** `src/app/features/{admin,secretaria}/asistencia/*.component.ts`
- **Qué cambia:** pasan el input nuevo `[savingAlertaId]` al Dumb. Cambio de una línea cada uno.

- **Archivo:** `src/app/core/facades/asistencia-clase-b.facade.spec.ts`
- **Qué cambia:** tests de `sendReminder` (hoy 0 cobertura) — TDD: escribir primero.

## Test de Regresión

5 tests nuevos en `asistencia-clase-b.facade.spec.ts` (todos verdes, verificados con
`npx vitest run` → 13/13 en el archivo; suite completa `npm run test:ci` → 1683/1683):

- `sendReminder crea la notificación con el users.id del alumno (no students.id)` ✓
- `sendReminder NO muestra toast de éxito si el envío falla` ✓
- `sendReminder no notifica ni miente si el alumno no tiene user_id` ✓
- `sendReminder marca y limpia isSaving` ✓
- `sendReminder ignora un enrollmentId que no está entre las alertas` ✓

## Verificación visual (/verify, 2026-08-01)

Corrida en `/app/admin/asistencia` como admin, 1280×800. **Prueba en vivo de la causa raíz:**
`GET /students?select=user_id&id=eq.115` → 200, seguido de `POST /notifications` → **201**.
La notificación se crea de verdad; el stub ya no miente.

Resto de probes: consola limpia (0 errores), sin 4xx/5xx, datos reales (5 alertas desde
Supabase, cero mock), contrato app-like intacto (`documentScrolls: false`, `contain: size`,
rail con scroll interno, 0 violaciones inline), sin overflow horizontal, claro y oscuro OK,
mobile 375 OK.

**Ronda de feedback visual del owner** (misma dinámica que spec 0030 — el QA geométrico no lo
detectó): con `btn-ghost` el "Eliminar" quedaba en texto plano y se leía como etiqueta, no
como botón. Corregido a `btn-danger-ghost`, que ya existía en el DS (`tailwind.css:319`) y
resuelve borde + señal de destructivo a la vez. Contraste medido en runtime: dark ~6.6:1,
light ~7.5:1, ambos AA.

## Hallazgos derivados (fuera de alcance, levantados aparte)

- **ASG-b-060** — el CTA del `ConfirmModalService` ignora `severity: 'danger'` y sale en azul
  de marca. Transversal a toda confirmación destructiva de la app, no solo a esta pantalla.
- Botones del rail a 30–32px de alto en móvil, bajo el mínimo táctil de 44px. Pre-existente
  del canon `btn-sm` (`fix-086-m`), no introducido acá.

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
