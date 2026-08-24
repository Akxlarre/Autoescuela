# Fix: Cursos Singulares no está en el panel de secretaria
> id: fix-201-m-cursos-singulares-panel-secretaria
> refs: —
> status: done
> closed: 2026-08-24
> created: 2026-08-24

## Root Cause
`AdminContabilidadCursosComponent` (grupo "Finanzas y Caja") nunca se expuso al rol
secretaria: falta el path `contabilidad/cursos` bajo el bloque `secretaria` en
`app.routes.ts` y falta el `NavItem` "Cursos Singulares" en `SECRETARIA_NAV`
(`menu-config.service.ts`). Las otras 4 páginas del mismo grupo (Caja Diaria, Reportes,
Historial, Liquidaciones) sí tienen su ruta+ítem para secretaria — Cursos Singulares
quedó fuera por omisión, no por decisión de negocio.

## ACs Afectados
Ninguno — fix autónomo (no viene de una spec, es una omisión de rollout detectada en
código).

## Cambio
- **Archivo:** `src/app/app.routes.ts`
  **Qué cambia:** agrega `path: 'contabilidad/cursos'` bajo el bloque `secretaria`,
  reutilizando `AdminContabilidadCursosComponent` (mismo patrón ya usado para
  `alumnos/:id` y `configuracion-web`, compartidos entre admin y secretaria).
- **Archivo:** `src/app/core/services/auth/menu-config.service.ts`
  **Qué cambia:** agrega el `NavItem` "Cursos Singulares" al grupo "Finanzas y Caja" de
  `SECRETARIA_NAV`, apuntando a `/app/secretaria/contabilidad/cursos`.

## Test de Regresión
- Verificación manual: login como secretaria → el ítem "Cursos Singulares" aparece en
  el sidebar → navega a `/app/secretaria/contabilidad/cursos` → la vista carga sin
  errores de consola y sin depender de rutas `/app/admin/*`. ✓ Verificado por el
  usuario en navegador real (2026-08-24).
