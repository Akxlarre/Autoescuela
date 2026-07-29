# Acceptance 0021-b — ROUTES.md + huérfanos (2026-07-01)

> Ejecutado por Fable 5.

| AC | Resultado | Evidencia |
|----|-----------|-----------|
| AC1 (colector) | ✅ | 107 rutas en ROUTES.md: path completo, componente (lazy `m.X`), guards (incluye calls `hasRoleGuard(['admin'])`), archivo |
| AC2 (fidelidad) | ✅ | Muestreo contra app.routes.ts: `/login`+guestGuard, `/app`+AppShell+authGuard, matricula+`enrollmentDraftGuard` (canDeactivate), `/`→/login, `/**`→NotFound, grupos de rol con su guard |
| AC3 (huérfanos componentes) | ✅ | 11 componentes sin consumidores. Spot-check con boundary correcto: `app-kpi-card` real tiene 0 usos (las páginas usan solo `app-kpi-card-skeleton` — el KPI real fue reemplazado por los KPIs del section-hero, spec 0015); `app-drawer` 0 usos |
| AC4 (huérfanos directivas) | ✅ | `[appHasRole]` y `[appModalOverlay]` sin uso en templates (verificado por grep: solo definición + READMEs) |
| AC5 (disclaimer + exclusión de enrutados) | ✅ | Nota fija en la sección; componentes con ruta directa excluidos por importPath |
| AC6 (idempotencia + cache) | ✅ | Segunda corrida sin cambios, páginas "(156 cached)" |
| AC-E1 (shared consume shared) | ✅ | `app-skeleton-block` lista consumidores `shared/components/*` (agenda-semanal, alumnos-list-content, …); componentes mapeados 61→68 al sumar shared/ |
| AC-E2 (children anidados) | ✅ | `/app/admin/flota/hoja-de-ruta/:id`, `/app/secretaria/documentos/alumnos/:id` concatenados correctos |
| AC-E3 (guard inline) | ✅ | `getText()` del AST preserva cualquier expresión; no existen guards inline hoy (cubierto por diseño) |

## Momento meta destacado

Los spot-checks iniciales de AC3 "refutaban" al detector (`<app-kpi-card` grepeado sin
boundary matcheaba `<app-kpi-card-skeleton`) — **el mismo bug de word-boundary** que
motivó el fix de conteo en STYLES.md. El detector estaba correcto; el grep manual no.

## Pendiente para el humano

- Agregar `indices/ROUTES.md` a la lista del Discovery Gate (`.claude/hooks/` protegido).

## Estado: DONE
