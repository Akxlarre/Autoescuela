# Fix: Guard de ruta para Clase Profesional en sede sin programa profesional
> id: fix-029-b-guard-ruta-profesional-sede
> refs: fix-028-gating-profesional-sede-sin-profesional / 0017 (RF-013)
> status: done
> closed: 2026-06-25
> created: 2026-06-25

## Root Cause
fix-028 cerró el gating del **menú** (sidebar) y del **selector** (`setProfessionalOnly`), pero
una **secretaria sin grant** anclada a una sede sin `has_professional` que escribe la **URL
directa** de una página profesional igual entra y ve una vista vacía (el menú la bloquea, pero
no hay protección a nivel de ruta). No hay fuga de datos — es UX. Falta el guard de ruta.

## ACs Afectados
- Gating profesional (extensión de fix-028): "una secretaria sin grant no puede acceder por URL a
  páginas profesionales si su sede no ofrece Clase Profesional → se la redirige a su portal".
- Admin y secretaria CON grant NO se ven afectados (tienen selector; `setProfessionalOnly` gobierna).

## Cambio
- **`core/guards/professional-branch.guard.ts`** (nuevo): `CanActivateFn` que reutiliza
  `canAccessProfessional`. Para usuarios con selector (admin / secretaria con grant) → `true`
  (no interfiere con `setProfessionalOnly`). Para secretaria sin grant → evalúa su sede fija;
  si no tiene profesional, redirige a `/app`.
- **`app.routes.ts`**: aplicar `canActivate: [professionalBranchGuard]` a las rutas profesionales
  de **secretaría** (las de admin ya están acotadas por rol y tienen selector).

## Test de Regresión
- `professional-branch.guard.spec.ts`: secretaria sin grant en sede sin prof → redirige;
  secretaria sin grant en sede con prof → pasa; secretaria con grant → pasa; admin → pasa.
  (La decisión de fondo ya está cubierta por `professional-access.utils.spec`, 10/10.)
- `ng build` limpio.
