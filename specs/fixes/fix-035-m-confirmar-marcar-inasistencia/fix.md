# fix-035-m — Asistencia B: falta confirmación antes de marcar inasistencia

## Contexto

El dueño reportó que el botón X ("Marcar inasistencia") en la tabla de
Asistencia del Día — Prácticas (`/app/admin/asistencia` y
`/app/secretaria/asistencia`) marca la inasistencia **inmediatamente** al
hacer clic, sin ningún paso de confirmación. Un clic accidental deja al
alumno marcado como "Ausente" sin forma de deshacerlo directamente desde
la tabla (genera penalización de faltas consecutivas — RF-053).

## Causa raíz

`asistencia-clase-b-content.component.ts:433-446` — el botón de icono
`x-circle` emite `markAttendance.emit({ sessionId: row.id, status: 'ausente' })`
directo en `(click)`, sin diálogo intermedio. Los componentes padre
(`admin-asistencia.component.ts:43` y
`secretaria-asistencia.component.ts:39`) escuchan `(markAttendance)` y
llaman `facade.markAttendance(...)` de forma directa también.

El proyecto ya tiene un mecanismo estándar para esto:
`ConfirmModalService` (`core/services/ui/confirm-modal.service.ts`),
inyectado en Smart Components (nunca en Dumb — ver
`indices/COMPONENTS.md` entrada `app-user-panel`: "el segundo paso de
confirmación es responsabilidad del Smart parent"). Ya se usa en varios
Smart Components (`admin-alumno-detalle`, `secretaria-ex-alumnos`,
`admin-contabilidad-cuadratura`, etc.) con el mismo patrón
`await this.confirmModal.confirm({...})`.

`asistencia-clase-b-content.component.ts` es un Dumb Component (`shared/`)
— no debe inyectar `ConfirmModalService` directamente. El paso de
confirmación debe vivir en los dos Smart Components que lo consumen.

## Alcance

1. `features/admin/asistencia/admin-asistencia.component.ts`: inyectar
   `ConfirmModalService`. Reemplazar
   `(markAttendance)="facade.markAttendance($event.sessionId, $event.status)"`
   por `(markAttendance)="onMarkAttendance($event)"`, con un método que
   llama `await this.confirmModal.confirm({ title: 'Marcar inasistencia',
   message: '...', severity: 'danger', confirmLabel: 'Marcar ausente' })`
   y solo si se confirma, llama `facade.markAttendance(...)`.
2. Mismo cambio en
   `features/secretaria/asistencia/secretaria-asistencia.component.ts`.
3. No se toca `asistencia-clase-b-content.component.ts` (dumb, sin
   servicios) ni la lógica del Facade (`AsistenciaClaseBFacade.markAttendance`).

El modal en sí (`ConfirmModalService` + su renderizado global en
`AppShellComponent`) ya existe y no requiere cambios.

## Acceptance Criteria

- [x] AC0: Al hacer clic en el botón X (marcar inasistencia) en
  `/app/admin/asistencia`, se muestra un modal de confirmación antes de
  ejecutar la acción. Implementado vía `onMarkAttendance()` +
  `ConfirmModalService.confirm()`.
- [x] AC1: Si se cancela el modal, la clase permanece en estado
  "Pendiente" — `if (!confirmed) return;` corta antes de llamar al Facade.
- [x] AC2: Si se confirma, se marca "Ausente" igual que antes — mismo
  `facade.markAttendance(event.sessionId, event.status)` de siempre.
- [x] AC3: Mismo comportamiento en `/app/secretaria/asistencia` — mismo
  patrón replicado en `SecretariaAsistenciaComponent`.

## Cierre

`tsc --noEmit` sin errores en ambos archivos. Verificación visual
confirmada por el dueño en vivo. Fix cerrado.

## Test de regresión

Cambio de coordinación en Smart Components (no lógica pura nueva en
Facade/utils) — se verifica con `tsc --noEmit` + verificación visual
manual (Playwright MCP no disponible en este entorno) a confirmar por el
dueño: clic en X → aparece modal → cancelar no marca ausente → confirmar
sí marca ausente.
