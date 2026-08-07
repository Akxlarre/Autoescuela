# Fix: Cobertura data-llm-* — Lote 4 (shared/components parte 2)
> id: fix-016-i-cobertura-data-llm-lote-4
> refs: ASG-b-007
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Root Cause
[Heredado de ASG-b-007, a confirmar]: Cuarto y último lote de cobertura `data-llm-*` (ver
ASG-b-004 para el contexto completo de la regla `.claude/rules/ai-readability.md` — Shadow
Semantic Overlay). 9 componentes de `shared/components/` sin ningún atributo `data-llm-*`.

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec). Cambio puramente de
atributos `data-llm-*`, sin impacto funcional ni visual.

## Cambio
Agregar `data-llm-action`/`data-llm-description` en:

- `src/app/shared/components/empty-state/empty-state.component.ts`
- `src/app/shared/components/evaluation-checklist/evaluation-checklist.component.ts`
- `src/app/shared/components/flota-list-content/flota-list-content.component.ts`
- `src/app/shared/components/media-upload-control/media-upload-control.component.ts`
- `src/app/shared/components/public-enrollment-steps/public-contract/public-contract.component.ts`
- `src/app/shared/components/servicios-especiales-content/drawers/agregar-servicio-drawer.component.ts`
- `src/app/shared/components/signature-pad/signature-pad.component.ts`
- `src/app/shared/components/tabs/tabs.component.ts`
- `src/app/shared/components/user-panel/user-panel.component.ts`

⚠️ Nota heredada de la Asignación: verificar overlap con ASG-b-012 (matrícula pública) por
`public-contract.component.ts` — **ya verificado en la reclamación (2026-08-05): ASG-b-012 está
completada** (fix-069-b-matricula-publica-varios, cerrada 2026-07-29), sin riesgo de solape real.

⚠️ `tabs.component.ts` es un componente base reutilizado en muchas páginas — revisar con cuidado
que el atributo no rompa nada al reutilizarse (Dumb component, solo `input()`/`output()`, no
debería tener lógica que se vea afectada por un atributo HTML estático).

## Test de Regresión
- Sin lógica nueva — cambio de atributos HTML estáticos, no requiere test unitario.
- Manual: `ng build` limpio, y correr los `.spec.ts` existentes de estos 9 componentes (los que
  tengan) para confirmar que ningún test dependa de un snapshot exacto del DOM que el atributo
  nuevo pudiera alterar.

## Resultado
- **~33 atributos `data-llm-*`** agregados en los 9 archivos. `tabs.component.ts` usa binding
  dinámico (`[attr.data-llm-action]="'seleccionar-tab-' + tab.id"`, mismo patrón que
  `app-section-hero`) por ser un componente base reutilizado con distintos ids según consumidor.
- Solo `empty-state.component.ts` tenía `.spec.ts` — está excluido de la suite en
  `vitest.config.ts` (línea 24, `@analogjs/vite-plugin-angular` rompe TestBed para tests de
  template) desde antes de este fix, no relacionado al cambio.
- `npx ng build --configuration=development` limpio.
- `npm run lint:arch` exit 0. 3 warnings preexistentes de `ARCH-09` (clase >200 líneas) en
  `flota-list-content` (625→637), `public-contract` (295→305) y `signature-pad` (223→224) —
  todos ya estaban sobre el límite antes de este fix, confirmado con `git diff --stat` (solo
  22 líneas agregadas en total entre los 3).
- Overlap con ASG-b-012 (`public-contract.component.ts`) descartado: esa asignación ya estaba
  completada (fix-069-b) antes de empezar este fix.
