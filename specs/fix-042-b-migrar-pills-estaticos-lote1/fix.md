# Fix: Migrar pills estáticos a app-badge — lote 1 (codemod, 24 archivos)
> id: fix-042-b-migrar-pills-estaticos-lote1
> refs: fix-036-app-badge-fuente-unica, fix-038-app-badge-variant-brand
> status: done
> closed: 2026-07-08
> created: 2026-07-08

## Root Cause
Quinto lote de la migración de pills ad-hoc del baseline ARCH-15 (fase 4,
`docs/BACKLOG-DEUDA-TECNICA.md`). Tras fix-037/039/040 (3 archivos, 1 por 1, con
verificación Playwright completa cada vez), el ritmo era insostenible: 66 archivos
restantes, 85% con solo 1-2 pills — el overhead de un ciclo completo por archivo es
desproporcionado para casos triviales.

Análisis de los 107 pills restantes separó dos categorías por riesgo:
- **Estáticos** (41 instancias, ~35 archivos): clase `text-{success|warning|error|info|brand}`
  literal en el mismo atributo `class`, sin `[style.*]` ni `[class]` dinámico — el color no
  depende de ninguna condición, es mecánico y seguro de automatizar.
- **Dinámicos** (66 instancias, ~40 archivos): helpers `getXColor()/getXBg()` o
  `[class]="metodoQueRetornaClases(x)"` — requieren leer la lógica de cada archivo para
  mapear correctamente el umbral/condición a un variant. Igual de manual que fix-037/039/040.

Este fix cubre el subconjunto estático que un script pudo emparejar con seguridad:
**30 spans en 24 archivos** (de las 41 estimadas — las 11 restantes tenían variaciones de
formato que el matcher no reconoció con confianza suficiente, quedan para un lote 2).

Bug evitado: el primer intento de generar el `import`/registro de `BadgeComponent` fallaba
en 9 de los 24 archivos por usar regex con `\n` en vez de `\r?\n` — el repo mezcla finales de
línea CRLF. Detectado con `--dry` antes de escribir nada (mismo hábito que salvó a fix-033).

## ACs Afectados
Ninguno — fix autónomo (fase 4 del roadmap, quinto lote de migración, primer lote
semi-automatizado).

- AC-1: 30 spans en 24 archivos migran de `<span class="...rounded-full...">` a
  `<app-badge [variant]="...">`, preservando el contenido interno exacto (íconos incluidos)
  y el color visual (mapeo 1:1 clase-literal → variant).
- AC-2: Cada archivo tocado importa y registra `BadgeComponent` correctamente (import
  statement + `imports: [...]` del decorador, incluyendo los 9 archivos que no tenían
  ningún array `imports:` previo).
- AC-3: `npm run lint:arch` sin regresión — ARCH-11 (clases muertas) y ARCH-14 (íconos) sin
  nuevos hallazgos en los 24 archivos; baseline ARCH-15 baja de 107 a 77.
- AC-4: `ng build` verde en los 24 archivos.
- AC-5: Verificación: mecanismo CSS de los 4 variants usados (warning/error/brand/success)
  confirmado con harness sintético + al menos 1 archivo verificado en página real
  (`admin-usuarios.component.ts`, badge "PLANO" renderizado correctamente).

## Cambio
- **Script (scratch, no versionado):** codemod ad-hoc de una sola vez — matcher de spans
  estáticos + inserción de import/registro, ejecutado con `--dry` antes de aplicar.
- **24 archivos** en `src/app/features/**` y `src/app/shared/components/**` (ver commit) —
  pill ad-hoc → `<app-badge [variant]="...">`, import + registro de `BadgeComponent`.
- Formateo posterior con `npx prettier --write` (el codemod no pasa por el hook de Prettier
  del Edit tool, al ejecutarse vía Bash).

## Test de Regresión
- `npm run lint:arch` → sin regresión (0 errores, ARCH-11 solo el hallazgo residual
  pre-existente `text-bg-surface` en `dms-list-content.component.ts`, confirmado fuera de mi
  diff); baseline ARCH-15 consolidado 107 → 77
- `ng build` verde
- Harness Playwright: los 4 variants (warning/error/brand/success) generan CSS correcto
- Verificación en página real: `/app/admin/usuarios` — badge "PLANO" (`badge-warning`)
  renderiza con el color correcto, consola sin errores
