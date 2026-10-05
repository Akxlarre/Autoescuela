# Fix: Pre-inscritos (bloqueado en el piloto) se abre igual desde la Base Profesional y las notificaciones
> id: fix-328-m-pre-inscritos-oculto-en-piloto
> refs: fix-319-m-testing-clase-profesional-piloto (S3, S21, D1) · fix-256-m · ASG-i-025
> status: in_progress
> created: 2026-10-05

## Root Cause
`fix-256-m` bloqueó la ruta de Pre-inscritos con `pilotPhaseGuard`, pero el botón "Pre-inscritos"
del hero de la Base Profesional embebe el componente completo (lista + drawer con evaluar y
matricular) dentro de la misma URL, sin pasar por el guard
(`alumnos-profesional-list-content.component.ts:445-451,543-547`). Además una notificación de
pre-inscripción navega a la ruta bloqueada y termina en "Módulo no disponible"
(`layout/topbar.component.ts:51-54`).

Decisión D1 (Matías, 2026-10-05): **se oculta** mientras Pre-inscritos esté bloqueado, y la
notificación tampoco debe llevar al módulo.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- **`src/app/shared/components/alumnos-profesional-list-content/alumnos-profesional-list-content.component.ts`**
  — sin botón "Pre-inscritos" cuando `isBlockedInPilot('clase-profesional-recorte')`.
- **`src/app/layout/topbar.component.ts`** — la notificación de pre-inscripción no navega (o no se
  muestra como enlace) mientras el módulo esté bloqueado.

## Test de Regresión
- E2E (admin y secretaria): la Base Profesional no muestra "Pre-inscritos".
- Spec del topbar: con el recorte activo, la notificación de pre-inscripción no navega.
