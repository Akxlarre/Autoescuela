# Fix: Notificación class_b sin deep-link para secretaria en el topbar
> id: fix-092-m-deeplink-secretaria-notif-class-b
> refs: fix-091-m-alerta-secretaria-cierre-clase
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause
La tabla de deep-links por `referenceType` × rol en `TopbarComponent.onNotifClicked()`
(`src/app/layout/topbar.component.ts:292-318`) tiene un `switch` sobre `n.referenceType`.
El caso `'class_b'` solo resuelve ruta para `role === 'instructor'`
(`/app/instructor/horario`) y `role === 'alumno'` (`/app/alumno/horario`) — no hay rama
para `secretary`/`secretaria`, cae al `default: return null` y el panel simplemente se
cierra sin navegar.

Esto no rompía nada porque hasta fix-091 ninguna notificación `class_b` se dirigía a
secretaría. Al extender `notify_class_b_completed()` (fix-091, ASG-b-044) para notificar
también a las secretarias de la sede, quedó expuesto el gap: la secretaria ve la
notificación en la campana del topbar pero al hacer clic no navega a ningún lado.

## ACs Afectados
Ninguno — fix autónomo, gap descubierto durante QA conversacional de fix-091 (no hay
spec ni AC formal detrás de la tabla de deep-links del topbar).

## Cambio
- **`src/app/layout/topbar.component.ts`**: agrega la rama
  `if (isSecretaria) return '/app/secretaria/agenda';` al case `'class_b'`. Misma
  granularidad ya usada para instructor/alumno en este mismo caso (navega a la página
  de agenda/horario, no al detalle de una sesión puntual — el modelo de notificación no
  trae `student_id`, solo `enrollment_id`, así que resolverlo a un detalle específico
  requeriría una query adicional fuera de alcance de este fix).
  - **Ajuste de implementación (Functional Core):** el `switch` completo (antes un
    closure inline dentro de `onNotifClicked()`) se extrajo a la función pura exportada
    `resolveNotificationRoute(referenceType, referenceId, role)`, en el mismo archivo.
    `onNotifClicked()` ahora solo la llama y navega. Motivo: `TopbarComponent` importa
    transitivamente `NotificationsPanelComponent` (con `styleUrl` externo) y el
    `TestBed` de este proyecto no logra resolver ese recurso al montar el componente
    completo (`Error: Component 'NotificationsPanelComponent' is not resolved:
    styleUrl...`) — un problema de infraestructura de testing, no del fix. Extraer la
    lógica de ruteo a función pura permite testear la decisión (regla `architecture.md`
    §Núcleo Funcional) sin depender de `TestBed`, evitando ese bloqueo por completo.

## Test de Regresión
- `src/app/layout/topbar.component.spec.ts > resolveNotificationRoute — referenceType "class_b"` — 5 casos, todos verdes: `npx vitest run src/app/layout/topbar.component.spec.ts` → 5/5 passed.
