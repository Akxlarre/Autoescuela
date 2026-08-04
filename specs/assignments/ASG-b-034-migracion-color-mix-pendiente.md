# Asignación ASG-b-034 — Terminar la migración de `color-mix()` pendiente

> **status:** reclamada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-25
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-07-31
> **resulting_track:** fix-076-b-color-mix-drift-y-criterio

---

## Contexto / Objetivo

`scripts/migrate-color-mix-t4.mjs` y las 3 variantes `migrate-inline-*.mjs` corrieron **una
sola vez** el 28-may-2026 (commit `673c4bd`) y fueron ejecutados ese mismo día sobre el
codebase de entonces (commits `refactor(admin/alumno/instructor/secretaria/features/shared):
migrate inline styles...`). No son utilidades reutilizables ni hay guardrail de lint que los
vuelva a correr — son tooling de un solo uso que ya cumplió su ciclo.

Verificado hoy: 67 archivos en `src/app` todavía tienen `color-mix()`. Dos causas distintas:

1. **Drift** (11 archivos): componentes creados **después** del 28-may reintrodujeron el
   mismo patrón simple `style="...color-mix(in srgb, var(--token) N%, transparent)..."` que
   el script ya sabía resolver. Ejemplos: `admin-reagendar-clases-drawer.component.ts`
   (creado 08-jul), `registrar-gasto-fijo-drawer.component.ts` (13-jun),
   `schedule-grid.component.ts` (19-jun). Nadie corrió el script de nuevo desde mayo.

2. **Gap de diseño del script** (56 archivos): el script solo procesaba atributos HTML
   `style="..."` estáticos. Nunca cubrió (a) CSS embebido dentro del array `styles: [...]`
   del `@Component` (ej. `admin-ficha-tecnica.component.ts:283-309`, `admin-auditoria.
   component.ts`, `hero-tab.component.ts`, `admin-contabilidad-cursos.component.ts`), ni
   (b) bindings dinámicos `[style.background]="cond ? 'color-mix(...)' : '...'"` — estos
   últimos los excluía a propósito (comentario en el script: "Skips `[style.xxx]="..."`
   Angular bindings") porque convertirlos a clases requiere reescribir a `computed()` +
   `[class.x]`, no un simple regex.

## Alcance sugerido

1. Migrar los 11 archivos con `style=""` estático remanente al mismo patrón
   `bg-COLOR/N` / `border-COLOR/N` que ya usa el resto del código (correr o adaptar
   `scripts/migrate-color-mix-t4.mjs` sobre ellos).
2. Decidir qué hacer con los 56 casos de CSS embebido / bindings dinámicos:
   ¿convertirlos a clases Tailwind + `computed()`/`[class.x]`, o aceptar
   `color-mix(var(--token))` ahí como válido porque ya usa tokens semánticos y no es
   "color hardcodeado"? Documentar la decisión (afecta si esto se sigue contando como
   deuda técnica o se cierra como "por diseño").
3. Si se decide seguir permitiendo `color-mix()` en ciertos casos, evaluar agregar una
   regla ARCH al linter que distinga "color-mix con token semántico" (permitido) de
   "color-mix/hex hardcodeado" (prohibido) — para que esto no se vuelva a confundir con
   deuda pendiente en una futura auditoría.

## Referencias

- `scripts/migrate-color-mix-t4.mjs`, `scripts/migrate-inline-styles-v2.mjs`,
  `scripts/migrate-inline-final.mjs`, `scripts/migrate-inline-styles.mjs`.
- Commit `673c4bd` (28-may-2026) — creación de los scripts.
- Commits del mismo día (`refactor(admin|alumno|instructor|secretaria|features|shared):
  migrate inline styles...`) — única corrida real de la migración.
- `docs/BACKLOG-DEUDA-TECNICA.md` — candidato a sumar esta entrada si el equipo confirma
  que sigue siendo deuda.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/features/admin/alumno-detalle/reagendar-clases-drawer/admin-reagendar-clases-drawer.component.ts`
- `src/app/features/admin/contabilidad-reportes/registrar-gasto-fijo-drawer.component.ts`
- `src/app/shared/components/schedule-grid/schedule-grid.component.ts`
- `src/app/features/admin/alumno-detalle/components/ficha-tecnica/admin-ficha-tecnica.component.ts`
- `src/app/features/admin/auditoria/admin-auditoria.component.ts`
- `src/app/features/admin/configuracion-web/tabs/hero-tab.component.ts`
- (lista completa de los 67 archivos disponible corriendo
  `grep -rl "color-mix" src/app --include="*.ts"`)

## Notas para quien la reclame

- No es urgente ni corrompe datos — es deuda técnica de consistencia visual/DS.
- El punto 2 (decisión de diseño) puede justificar recalificar esto como `spec` en vez
  de `fix` al reclamarlo, si el equipo prefiere formalizar la regla antes de tocar código.
- No dupliques el trabajo de los scripts existentes — son buen punto de partida para el
  punto 1, solo hay que re-ejecutarlos o adaptarlos a los archivos nuevos.
