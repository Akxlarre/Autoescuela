# Asignación ASG-b-077 — App-like: piezas sueltas (`flota/mantenimientos`, `contabilidad/cursos`, `contabilidad/anticipos`)

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Paso 10 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`) — 3 páginas sin relación entre sí,
agrupadas por ser candidatas sueltas de complejidad baja-media (mismo criterio que usaron los
lotes `data-llm-*` para agrupar piezas chicas). Se pueden hacer en cualquier orden, incluso por
separado si alguien prefiere reclamar solo una parte.

### `/admin/flota/:id/mantenimientos` (`VehicleMaintenancesComponent`)

Orden real es tabla PRIMERO, `bento-square`s de "próximas fechas" DESPUÉS (0-N según data) — al
revés del patrón KPI-row-luego-contenido del resto del DS.

Plan: reordenar template — mover los `bento-square` ANTES de la tabla (para calzar con
`--fill-screen-kpi`, auto-auto-fill). Tabla ya tiene `p-table [paginator]="true"` → agregar
`[scrollable]="true" scrollHeight="flex"` (mantiene paginador, patrón estándar).

### `/admin/contabilidad/cursos` (`AdminContabilidadCursosComponent`)

Hero + 1 sola `.bento-banner` con `<table>` hand-rolled, sin paginación.

Plan: root → `--fill-screen` (singular), `.bento-fill` en la tabla, wrapper interno
`flex-1 min-h-0 overflow-y-auto`. Sin decisión de paginación pendiente.

### `/admin/contabilidad/anticipos` (`AdminContabilidadAnticiposComponent`)

Hero + toolbar (`.bento-banner` propia) + 2 tablas hand-rolled apiladas (cuenta corriente,
historial), sin paginación ni tabs — son **4 filas conceptuales**, no 3. Ningún
`--fill-screen-*` cubre "hero + toolbar auto + 2 filas fill apiladas" directamente.

Plan (recomendado, consistente con la decisión tomada en `/admin/auditoria`, ASG-b-069): plegar
el toolbar como header fijo (`shrink-0`) dentro de la primera tabla, para volver a 3 filas
conceptuales y usar `--fill-screen-2`. Si al implementar se ve mejor mantener el toolbar
separado, evaluar alternativa B (modificador nuevo) — no es una decisión cerrada al 100%.

## Checklist de cierre (rollout app-like, aplica a las 3)

- [ ] `force-compact` verificado con drawer abierto (cada página)
- [ ] Sin `.spec.ts` nuevo obligatorio en ninguna (sin lógica de densidad nueva)
- [ ] `/verify` en 390×844, 1440×900 y 768 de alto (cada página)

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — filas `/admin/flota/:id/mantenimientos`,
  `/admin/contabilidad/cursos`, `/admin/contabilidad/anticipos`
- `specs/assignments/ASG-b-069-app-like-admin-auditoria.md` — precedente del "plegar toolbar
  como header fijo"

## Archivos involucrados

- `src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.ts`
- `src/app/features/admin/contabilidad-cursos/admin-contabilidad-cursos.component.ts`
- `src/app/features/admin/contabilidad-anticipos/admin-contabilidad-anticipos.component.ts`
