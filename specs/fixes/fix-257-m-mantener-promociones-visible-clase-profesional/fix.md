# Fix: Mantener "Promociones" de Clase Profesional visible en la fase piloto

> id: fix-257-m
> refs: ASG-i-009, fix-256-m
> status: done
> closed: 2026-09-21
> created: 2026-09-21

## Root Cause

fix-256-m ocultó 8 módulos de Clase Profesional (incluyendo Promociones) siguiendo la lista
literal de ASG-i-009. Al revisar el resultado, el dueño (autoridad de producto) decidió que
"Promociones" no genera la misma confusión que el resto y debe seguir visible/accesible
durante el piloto — corrección de alcance sobre una decisión ya implementada, no un bug.

## ACs Afectados

Ninguno — fix autónomo (corrección de alcance post-implementación de fix-256-m).

- AC-1: `clase-profesional/promociones` (admin) y `profesional/promociones` (secretaria)
  vuelven a ser accesibles — ya no redirigen a `/modulo-no-disponible`.
- AC-2: El ítem de menú "Promociones" vuelve a mostrarse en "Academia Profesional" para
  admin y secretaria.
- AC-3: Los otros 6 módulos (Pre-inscritos, Relatores, Asistencia, Certificados,
  Evaluaciones, Archivo, Ex-Alumnos Profesional) siguen ocultos sin cambios.

## Cambio

- **`src/app/app.routes.ts`** — quita `pilotPhaseGuard('clase-profesional-recorte')` de
  `clase-profesional/promociones` (admin) y `profesional/promociones` (secretaria; conserva
  `professionalBranchGuard`).
- **`src/app/core/services/auth/menu-config.service.ts`** — quita `hiddenInPilotRecorte: true`
  del ítem "Promociones" en `ADMIN_NAV` y `SECRETARIA_NAV`.

## Test de Regresión

- `menu-config.service.spec.ts > fix-256-m: oculta los 7 ítems recortados...` → se ajusta a 6
  ítems ocultos (se quita `'promociones'` de `hiddenRoutes`) y se agrega assert de que
  "Promociones" sigue presente.
