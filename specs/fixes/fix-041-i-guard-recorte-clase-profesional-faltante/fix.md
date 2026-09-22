# Fix: 4 rutas del recorte de Clase Profesional accesibles por URL directa sin guard

> id: fix-041-i-guard-recorte-clase-profesional-faltante
> refs: fix-037-i-qa-visual-piloto, ASG-i-009, fix-256-m
> status: draft
> created: 2026-09-22

## Root Cause

`ASG-i-009`/`fix-256-m` (2026-09-15) ocultó del menú lateral 6+ módulos de Clase Profesional
para el alcance piloto ("Base Alumnos Prof.", "Libro de Clases", pre-inscritos, relatores,
asistencia, certificados, evaluaciones, archivo) aplicando `pilotPhaseGuard('clase-profesional-
recorte')` a sus rutas en `app.routes.ts` — con la excepción intencional de "Promociones"
(revertida por `fix-257-m`, decisión de producto).

Al auditar `app.routes.ts` ruta por ruta (grep de `path: 'clase-profesional` y
`path: 'profesional/` + `path: 'libro-de-clases'`), **4 rutas quedaron marcadas "(Bloqueado)"
en el menú pero SIN el guard aplicado**:

| Ruta | Rol | Línea aprox. | Guard actual | Guard esperado |
|---|---|---|---|---|
| `admin/clase-profesional/alumnos` | Admin | 125 | ninguno | `pilotPhaseGuard('clase-profesional-recorte')` |
| `admin/libro-de-clases` | Admin | 293 | ninguno | `pilotPhaseGuard('clase-profesional-recorte')` |
| `secretaria/profesional/alumnos` | Secretaria | 407 | `professionalBranchGuard` | + `pilotPhaseGuard('clase-profesional-recorte')` |
| `secretaria/libro-de-clases` | Secretaria | 592 | `professionalBranchGuard` | + `pilotPhaseGuard('clase-profesional-recorte')` |

Confirmado en vivo (no solo por lectura de código): logueado como admin en la sede
"Autoescuela Chillán" (donde el menú muestra "Base Alumnos Prof." y "Libro de Clases" con
candado 🔒 "Bloqueado"), navegar directo a `/app/admin/clase-profesional/alumnos` y a
`/app/admin/libro-de-clases` **renderiza el módulo completo** (listado, KPIs, filtros) en vez
de redirigir a `/modulo-no-disponible`. Sin errores de consola — el módulo funciona
normalmente, solo que no debería ser alcanzable en esta fase del piloto.

Encontrado durante `fix-037-i-qa-visual-piloto` (QA del piloto), verificación explícita de "URL
directa a ruta oculta" (parte del alcance original de la Asignación ASG-i-012: "no solo que
desapareció del menú — probar la URL directa también").

## ACs Afectados

Ninguno — fix autónomo, gap de implementación de `fix-256-m` encontrado en QA posterior.

- AC-1: `admin/clase-profesional/alumnos` redirige a `/modulo-no-disponible` cuando el flag
  `clase-profesional-recorte` está activo.
- AC-2: `admin/libro-de-clases` redirige a `/modulo-no-disponible` en las mismas condiciones.
- AC-3: `secretaria/profesional/alumnos` redirige a `/modulo-no-disponible` (además de seguir
  aplicando `professionalBranchGuard` para el scope de sede).
- AC-4: `secretaria/libro-de-clases` redirige a `/modulo-no-disponible` (además de
  `professionalBranchGuard`).
- AC-5: no hay regresión en las rutas ya correctamente guardadas (`clase-profesional/pre-
  inscritos`, `/relatores`, `/asistencia`, `/certificados`, `/evaluaciones`, `/archivo` y sus
  equivalentes de secretaria) ni en `clase-profesional/promociones` (que debe seguir SIN guard,
  por decisión de `fix-257-m`).

## Cambio

- **`app.routes.ts`** — agregar `canActivate: [pilotPhaseGuard('clase-profesional-recorte')]` a
  las 2 rutas de admin (línea ~125 y ~293) y agregar `pilotPhaseGuard('clase-profesional-
  recorte')` al array `canActivate` ya existente (junto a `professionalBranchGuard`) en las 2
  rutas de secretaria (línea ~407 y ~592) — mismo patrón usado en las demás rutas del recorte
  (ej. línea 416: `canActivate: [professionalBranchGuard, pilotPhaseGuard('clase-profesional-
  recorte')]`).
- Fuera de alcance: no tocar `clase-profesional/promociones` (sin guard, intencional).

## Test de Regresión

- `npm run test:ci` — si existe un spec de `app.routes.ts` o de `pilotPhaseGuard` que enumere
  rutas guardadas, actualizarlo con las 4 rutas nuevas.
- Manual: `/verify` — logueado como admin y como secretaria en una sede con el flag activo,
  navegar directo a las 4 URLs y confirmar redirect a `/modulo-no-disponible`. Confirmar además
  que `clase-profesional/promociones` sigue siendo accesible (no debe regresar).

## Evidencia de Verificación

Pendiente.
