# Fix: Anticipos muestra enum crudo "both" sin traducir, KPIs financieros sin separador de miles + "Otros (Sede 0)" sin resolver nombre
> id: fix-070-m-formato-financiero-anticipos-reportes
> refs: ASG-020
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause

[Heredado de ASG-020, a confirmar]: 2 hallazgos de formato en módulos financieros:
- **H-004**: en Anticipos (`/app/admin/contabilidad/anticipos`), la columna TIPO muestra el enum crudo `both` para algunos instructores en vez de "Teórico y Práctico" (mismo valor, mapeo incompleto).
- **H-005**: los KPIs grandes de Reportes (`$ 180000`) y Cursos Singulares (`$220000`) omiten el separador de miles, mientras las tablas de las mismas páginas sí lo usan (`$180.000`). Además, en Reportes aparece una categoría "Otros (Sede 0)" — nombre de sede sin resolver, cae al id crudo.

## ACs Afectados

- Ninguno — fix autónomo, encadenado a ASG-020 (no proviene de una spec).

## Cambio

- **H-004** — `src/app/core/facades/anticipos.facade.ts` (`tipoLabel()`): la causa real no era un mapeo incompleto (`TIPO_LABELS` ya cubre `'both'`), sino que el lookup usaba el valor crudo de BD sin normalizar. `instructores.facade.ts` ya hace `trim().toLowerCase()` antes de mapear el mismo enum — `anticipos.facade.ts` no, así que instructores con `type` guardado con espacios/mayúsculas (ej. `"Both "`) caían al fallback `?? tipo` y mostraban el crudo. Se agregó la misma normalización.
- **H-005 (separador de miles)** — dos componentes armaban el KPI grande con `value: <number>` + `prefix: '$ '`/`'$'`, pero `SectionHeroComponent` solo interpola `{{prefix}}{{value}}{{suffix}}` sin formatear — a diferencia de las tablas de las mismas páginas, que sí llaman a un formatter `Intl`:
  - `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.ts` (`heroKpis`): ahora usa `this.clp(...)` (el mismo helper que ya usan las tablas de la página) en vez de pasar el número crudo con `prefix: '$ '`.
  - `src/app/features/admin/contabilidad-cursos/admin-contabilidad-cursos.component.ts` (`heroKpis`): ahora usa `formatCLP(...)` (mismo helper que ya usan las tablas de cursos) en vez de pasar el número crudo con `prefix: '$'`.
- **H-005 (sede "Otros (Sede 0)")** — investigado, **ya estaba resuelto** por fix-056 (branch_id no resoluble por bug array-vs-objeto en la relación `enrollments`, mismo root cause que H-013). Existe test de regresión específico (`reportes-contables.utils.spec.ts:80`, `'con showBranch, categoriza por la sede real en vez de caer en "Otros (Sede 0)"'`) que ya pasa en verde. No se tocó nada de esta parte — está fuera del alcance real de este fix.

## Test de Regresión

- `anticipos.facade.spec.ts > tipoLabel() > mapea "both" con espacios/mayúsculas (H-004: dato BD sucio) → Teórico y Práctico` ✓ (nuevo)
- `reportes-contables.utils.spec.ts > fix-056 > con showBranch, categoriza por la sede real en vez de caer en "Otros (Sede 0)"` ✓ (ya existía, confirma que la parte de sede de H-005 sigue resuelta)
- Suite completa (`npm run test:ci`): 1447/1447 en verde.
- `npm run lint:arch`: 0 errores (164 advertencias pre-existentes, ninguna nueva en los archivos tocados).
- **Verificación visual (Playwright MCP): NO ejecutada** — `mcp__playwright__*` no estuvo disponible durante la implementación. El dueño del proyecto (Matías) confirmó cerrar el fix igualmente sin verificación visual, dado que el cambio es de formato puro (Intl.NumberFormat) con tests unitarios en verde.
