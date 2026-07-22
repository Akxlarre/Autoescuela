# Fix: Completar cobertura data-llm-action/description/nav (ai-readability.md)
> id: fix-055-b-ai-readability-data-llm-coverage
> refs: indices/FLOWS-QA-AUDIT.md (Fase 5.9, hueco detectado post-cierre del audit)
> status: done
> closed: 2026-07-22
> created: 2026-07-22

## Root Cause
La regla `ai-readability.md` (Shadow Semantic Overlay) nunca se auditó a nivel de código
durante la Auditoría QA de Flujos de Usuario. Un grep exhaustivo encontró 35 archivos con
`<button>`/`<input>` que no tienen ningún atributo `data-llm-action`, `data-llm-description`
ni `data-llm-nav` — quedan invisibles semánticamente para agentes que inspeccionen el DOM.

## ACs Afectados
Ninguno — fix autónomo (deuda de AI-readability, no un AC de spec).

## Cambio
- **Alcance reducido, a pedido del owner** (se detuvo el trabajo en solitario para repartirlo en el equipo — ver `specs/ASSIGNMENTS.md` ASG-002..ASG-005). De los 35 archivos originales:
  - **3 archivos COMPLETOS**: `historial-emisiones-drawer.component.ts`, `configurador-horarios-drawer.component.ts`, `general-tab.component.ts`.
  - **1 archivo PARCIAL**: `hero-tab.component.ts` — solo los 4 botones de "Tipo de Fondo" (pills tema/color/imagen/video) tienen `data-llm-action`; quedan ~19 elementos sin tocar (pills de media lateral, inputs de headline/subheadline/trust-badge/CTA, selector de íconos completo). Queda documentado en `ASG-003` para quien lo retome.
  - **31 archivos SIN TOCAR**: repartidos en `specs/ASSIGNMENTS.md` (ASG-002 a ASG-005).
- **Qué cambia** (en lo ya hecho): `data-llm-action="verbo-kebab-case"` en botones de acción, `data-llm-description="..."` en inputs críticos. No se tocó lógica, solo atributos HTML.

## Test de Regresión
- `npm run test:ci` → 1350/1350 verde tras los 4 archivos tocados (solo atributos HTML, sin lógica).
- `npm run lint:arch` → sin nuevos errores.
