# Fix: Revertir pilotPhaseGuard aplicado por error a Base Alumnos Prof. y Libro de Clases
> id: fix-260-m-revertir-guard-piloto-base-alumnos-libro-clases
> refs: fix-256-m, fix-257-m, fix-041-i-guard-recorte-clase-profesional-faltante
> status: done
> closed: 2026-09-27
> created: 2026-09-27

## Root Cause

`fix-041-i` agregó `pilotPhaseGuard('clase-profesional-recorte')` a 4 rutas que el recorte
piloto (`fix-256-m`) dejaba **explícitamente fuera** del bloqueo: "Base Alumnos Prof." y
"Libro de Clases" (admin y secretaria). El QA se hizo como admin en una sede **sin** Clase
Profesional, donde el sidebar marca esos ítems "(Bloqueado)" por `requiresProfessional`
(scope de sede, `sidebar.component.ts`), no por la fase piloto. Se confundió el candado de
sede con el recorte piloto y se "completó" un guard que nunca debió existir. Resultado: con el
recorte activo, las 2 vistas redirigen a `/modulo-no-disponible` en toda sede.

## ACs Afectados

- fix-256-m: "Base Alumnos Prof." y "Libro de Clases" siguen accesibles durante el piloto.
- AC-1: `admin/clase-profesional/alumnos` y `admin/libro-de-clases` NO redirigen a
  `/modulo-no-disponible` con el recorte activo.
- AC-2: `secretaria/profesional/alumnos` y `secretaria/libro-de-clases` NO redirigen; siguen
  protegidas por `professionalBranchGuard`.
- AC-3: Sin regresión: las demás rutas del recorte siguen bloqueadas y Promociones sigue libre.

## Cambio

- **Archivo:** `src/app/app.routes.ts`
- **Qué cambia:** quitar `pilotPhaseGuard('clase-profesional-recorte')` de las 4 rutas
  (admin sin guard; secretaria vuelve a `[professionalBranchGuard]`). Nota en `fix-041-i`
  apuntando a este fix.

## Test de Regresión

- `npm run test:ci` en verde (sin regresiones vs baseline).
- Manual: navegar a las 4 URLs con el recorte activo y confirmar que renderizan.

## Progreso

- [x] Quitar el guard de las 4 rutas en `app.routes.ts`
- [x] `npx tsc --noEmit` limpio; `npm run test:ci` 2768 passed / 5 skipped
- [x] `indices/ROUTES.md` + nota de reversión en `fix-041-i`
- [x] Verificación manual en navegador (Playwright, 2026-09-27): admin@test.com → `clase-profesional/alumnos` y `libro-de-clases` renderizan; secretaria2@test.com (sede con Profesional) → `profesional/alumnos` y `libro-de-clases` renderizan; secretaria@test.com (sede sin Profesional) → redirige a su dashboard por `professionalBranchGuard` (esperado). `clase-profesional/relatores` sigue redirigiendo a `/modulo-no-disponible` (sin regresión). Consola: 0 errores.
