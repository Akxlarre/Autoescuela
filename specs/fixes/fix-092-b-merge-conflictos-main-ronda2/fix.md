# Fix: resolver conflictos de merge de origin/main en PR #87 (ronda 2)
> id: fix-092-b-merge-conflictos-main-ronda2
> refs: PR #87
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause

PR #87 volvió a `mergeable: CONFLICTING` inmediatamente después de la ronda anterior
(fix-085-b) — `main` avanzó 3 commits más (PR #88, `fix/detalles-finales`, trabajo de
Matías: unificación del módulo de auditoría + restaurar `log_change()` roto desde jun-14 +
notificaciones a secretaría de clase cerrada) mientras se resolvía la ronda 1. `main` es
un blanco móvil en este repo compartido — puede volver a pasar.

## ACs Afectados

Ninguno — resolución mecánica de conflictos de merge.

## Archivos involucrados

- `src/app/features/admin/auditoria/admin-auditoria.component.ts` — único conflicto de
  contenido real.
- `specs/ASSIGNMENTS.md`, `indices/DATABASE.md` — auto-merge limpio por git, sin
  intervención manual.

## Cambio

`admin-auditoria.component.ts` tenía 2 conflictos, mismo patrón que fix-085-b: mi lado
traía solo tokens del DS (`.overline`, `.item-title` de fix-078-b), el lado de Matías
traía funcionalidad real de la unificación del módulo de auditoría:

1. **Header de tabla**: `[class.audit-grid--no-sede]="!showSedeColumn()"` — oculta la
   columna "Sede" condicionalmente. Sin esto la tabla mostraría una columna vacía cuando
   `showSedeColumn()` es falso.
2. **Link de email del usuario**: `(click)="$event.stopPropagation()"` — la fila entera
   tiene `(click)="verDetalle(log)"` para abrir el detalle; sin `stopPropagation()`,
   clickear el mailto también dispararía la apertura del drawer de detalle.

Combinados ambos: se conservó la funcionalidad de Matías y se le aplicaron mis tokens
(`.overline`, `.item-title`) encima, sin perder ninguno de los dos lados.

`specs/ASSIGNMENTS.md` e `indices/DATABASE.md` se auto-mergearon limpio (ambos lados
agregaban filas/entradas nuevas sin pisarse) — no requirieron edición manual. Regenerados
igual con `npm run indices:sync` para consolidar.

## Test de Regresión

- `npm run lint:arch` → **exit 0**, 0 errores.
- `npx tsc --noEmit` → sin errores.
- `npm run test:ci` → **1678 passed, 3 skipped (pre-existentes), 0 failed, exit 0**
  (139/140 archivos, 210s). Sube de 1671→1678 respecto a fix-085-b — los 7 tests nuevos
  vienen del módulo de auditoría unificado de Matías (PR #88). Sin regresiones.
