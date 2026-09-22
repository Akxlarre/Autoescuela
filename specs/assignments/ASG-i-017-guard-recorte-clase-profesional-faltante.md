# Asignación ASG-i-017 — 4 rutas del recorte de Clase Profesional accesibles sin guard (🔴 alta)

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-22
> **created_by:** i
> **claimed_by:** i
> **claimed_at:** 2026-09-22
> **resulting_track:** fix-041-i-guard-recorte-clase-profesional-faltante

---

## Contexto / Objetivo

Encontrado durante el QA de `fix-037-i-qa-visual-piloto` (ASG-i-012), en la verificación
explícita de "URL directa a ruta oculta" que la propia ASG-i-012 pedía hacer. Es el hallazgo
de **mayor severidad** de toda la tanda de QA del piloto: rompe una decisión de scope/negocio
(`ASG-i-009`/`fix-256-m`), no es solo un defecto cosmético.

`fix-256-m` ocultó 8 módulos de Clase Profesional del menú para el alcance piloto, aplicando
`pilotPhaseGuard('clase-profesional-recorte')` a sus rutas. Auditando `app.routes.ts` ruta por
ruta, **4 quedaron marcadas "(Bloqueado)" en el menú pero SIN el guard aplicado**:

| Ruta | Rol | Guard actual |
|---|---|---|
| `admin/clase-profesional/alumnos` | Admin | ninguno |
| `admin/libro-de-clases` | Admin | ninguno |
| `secretaria/profesional/alumnos` | Secretaria | solo `professionalBranchGuard` |
| `secretaria/libro-de-clases` | Secretaria | solo `professionalBranchGuard` |

Confirmado en vivo (no solo lectura de código): logueado como admin en una sede donde el menú
muestra "Base Alumnos Prof." y "Libro de Clases" con 🔒, navegar directo a esas URLs
**renderiza el módulo completo**, sin redirigir a `/modulo-no-disponible`.

## Alcance sugerido

Ver `specs/fixes/fix-041-i-guard-recorte-clase-profesional-faltante/fix.md` — el track ya
tiene el diagnóstico completo, las 4 rutas exactas con su línea aprox. en `app.routes.ts`, y el
cambio propuesto (agregar `pilotPhaseGuard('clase-profesional-recorte')` al `canActivate` de
cada una, siguiendo el mismo patrón que las 6 rutas del recorte que sí están bien guardadas).

## Archivos involucrados

- `src/app/app.routes.ts` (4 entradas de ruta)

## Notas para quien la reclame

El track `fix-041-i-guard-recorte-clase-profesional-faltante` ya existe en estado `draft` con
el diagnóstico completo — no hace falta generarlo de nuevo. Lee el archivo, corre
`/spec-activate fix-041-i-guard-recorte-clase-profesional-faltante` y continúa el flujo SDD
normal. **Priorizar esta sobre las demás asignaciones de esta tanda** — es la única de
severidad alta (P0), el resto son P1/P2/P3.

Fuera de alcance: no tocar `clase-profesional/promociones`, que intencionalmente quedó sin
guard por decisión de producto (`fix-257-m`).
