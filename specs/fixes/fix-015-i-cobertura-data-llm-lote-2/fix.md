# Fix: Cobertura data-llm-* — Lote 2 (terminar hero-tab + 6 archivos completos)
> id: fix-015-i-cobertura-data-llm-lote-2
> refs: ASG-b-005
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Root Cause
[Heredado de ASG-b-005, a confirmar]: Segundo lote de cobertura `data-llm-*` (ver ASG-b-004 para
el contexto completo de la regla). Incluye terminar un archivo grande que se dejó a medias
(`hero-tab.component.ts`, un "studio" visual con selector de layout, pills de fondo/media y
selector de íconos con ~40 botones dinámicos — solo los 4 botones de "Tipo de Fondo" tienen el
atributo).

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec). Cambio puramente de
atributos `data-llm-*`, sin impacto funcional ni visual.

## Cambio
Agregar `data-llm-action`/`data-llm-description` (según `.claude/rules/ai-readability.md`) en:

- `src/app/features/admin/configuracion-web/tabs/hero-tab.component.ts` — terminar los ~19
  elementos restantes: pills de media lateral (3), inputs de headline/subheadline/trust-badge/CTA
  (7), selector de íconos completo (toggle dropdown, buscador, botón limpiar, pills de categoría,
  grilla de íconos — cada uno del `@for` cuenta como un solo elemento de plantilla).
- `src/app/features/admin/configuracion-web/tabs/promo-tab.component.ts`
- `src/app/features/admin/secretarias/admin-secretarias.component.ts`
- `src/app/features/auth/force-password-change/force-password-change.component.ts`
- `src/app/features/dashboard/dashboard.component.ts`
- `src/app/features/instructor/clase-detail/instructor-clase-detail.component.ts`
- `src/app/features/instructor/notificaciones/instructor-notificaciones.component.ts`

Referencia de convención exacta: `specs/fixes/fix-055-b-ai-readability-data-llm-coverage/fix.md`
(fix ya cerrado, hizo los primeros 3 archivos completos + el arranque de `hero-tab`).

⚠️ Nota heredada de la Asignación: coordinar con ASG-b-018 por `dashboard.component.ts` — **ya
verificado en la reclamación (2026-08-05): ASG-b-018 está completada** (fix-063-b-dashboard-kpis-estados,
cerrada 2026-07-28), sin riesgo de solape real.

## Test de Regresión
- Sin lógica nueva — cambio de atributos HTML estáticos, no requiere test unitario.
- Manual: `ng build` limpio (sin romper templates), y confirmar visualmente que ningún atributo
  `data-llm-*` quedó mal ubicado (ej. en el `<li>` del `@for` en vez de en el botón real).

## Resultado
- **43 atributos `data-llm-*` agregados** en los 7 archivos: `hero-tab.component.ts` (21, incluye
  los 4 preexistentes + 17 nuevos que cerraron los ~19 pendientes), `promo-tab.component.ts` (4),
  `admin-secretarias.component.ts` (7), `force-password-change.component.ts` (2),
  `dashboard.component.ts` (3), `instructor-clase-detail.component.ts` (5),
  `instructor-notificaciones.component.ts` (1).
- Los botones de `heroActions` que pasan por `<app-section-hero>` (ej. "Nueva Secretaria",
  "Marcar todas como leídas") ya se autotaguean vía `[attr.data-llm-action]="action.id"` en ese
  componente compartido — no se duplicó el atributo en los Smart Components consumidores.
- `npx ng build --configuration=development` limpio, dos veces (post `hero-tab` y post los 6
  archivos restantes).
- `npm run lint:arch` exit 0, sin warnings nuevos en ninguno de los 7 archivos.
- Revisión manual confirmó que ningún atributo quedó en el contenedor `@for` en vez del elemento
  interactivo real (pills de categoría, grilla de íconos, filas de notificación).
