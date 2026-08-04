# Fix: migración `color-mix()` pendiente — drift + criterio de diseño
> id: fix-076-b-color-mix-drift-y-criterio
> refs: ASG-b-034
> status: done
> closed: 2026-07-31
> created: 2026-07-31

## Root Cause

**[Heredado de ASG-b-034, a confirmar]:** `scripts/migrate-color-mix-t4.mjs` y las 3 variantes
`migrate-inline-*.mjs` corrieron **una sola vez** el 28-may-2026 (commit `673c4bd`) sobre el
codebase de ese día. No son utilidades reutilizables ni hay guardrail de lint que las vuelva a
correr — son tooling de un solo uso que ya cumplió su ciclo.

Verificado hoy: 67 archivos en `src/app` todavía tienen `color-mix()`, por dos causas:

1. **Drift** (11 archivos): componentes creados **después** del 28-may reintrodujeron el mismo
   patrón simple `style="...color-mix(in srgb, var(--token) N%, transparent)..."` que el script
   ya sabía resolver — nadie lo volvió a correr desde mayo.
2. **Gap de diseño del script** (56 archivos): el script solo procesaba atributos HTML
   `style="..."` estáticos; nunca cubrió CSS embebido en `styles: [...]` del `@Component` ni
   bindings dinámicos `[style.x]="..."` (excluidos a propósito — convertirlos a clases requiere
   `computed()` + `[class.x]`, no un regex).

## Decisión de diseño (parte 2, confirmada por el usuario)

Se auditaron los 67 usos actuales de `color-mix()` en `src/app`, incluido el caso dinámico más
complejo (`cuadratura-content.component.ts`, `colorDiferencia()` → siempre `var(--state-*)`) y
se comparó contra el propio patrón canónico del design system (`_form-fields.scss`,
`_primeng-overrides.scss`, `_scrollbar.scss`, `_public-enrollment.scss`): **100% de los usos, en
ambos lados, son `color-mix(in srgb, var(--token) N%, transparent|black)` — nunca un hex/rgb
crudo.**

**Criterio oficial:** `color-mix(in srgb, var(--token) N%, ...)` es **válido por diseño, NO es
deuda técnica**, sin importar si aparece en `style=""` estático, CSS embebido (`styles: [...]`)
o binding dinámico (`[style.x]`) — el token ya es semántico, `color-mix()` es solo su derivación
de opacidad/blend, igual que hace el propio DS. La única violación real sería `color-mix()` con
un color hardcodeado (hex/rgb/named) como ingrediente — no se encontró ningún caso así en el
codebase actual.

Documentado en `docs/BACKLOG-DEUDA-TECNICA.md`. Los 56 archivos de "gap de diseño" **se cierran
sin migrar** — ya cumplen la regla real. Punto 3 de la Asignación (nueva regla ARCH en el
linter) queda fuera de este track — no es necesaria hoy porque no hay violaciones que detectar,
se puede revisar más adelante si el patrón deriva.

## ACs Afectados
Ninguno — fix autónomo, sin AC de spec previa. Referencia: `specs/assignments/ASG-b-034-migracion-color-mix-pendiente.md`.

## Archivos involucrados

- Los 11 archivos con `style=""` estático remanente (drift) — re-ejecución/adaptación de
  `scripts/migrate-color-mix-t4.mjs`.
- `docs/BACKLOG-DEUDA-TECNICA.md` — documentar la decisión de diseño.

## Cambio

- Re-ejecutado `scripts/migrate-color-mix-t4.mjs` sobre el codebase actual (idempotente, solo
  toca atributos `style=""` estáticos con `color-mix`, nunca bindings `[style.x]`). Migró
  **10 archivos** de `style="...color-mix(...)..."` a clases `bg-COLOR/N`/`border-COLOR/N`:
  `admin-reagendar-clases-drawer.component.ts`, `registrar-gasto-fijo-drawer.component.ts`
  (×2, mismo nombre en 2 carpetas), `public-enrollment-retorno.component.ts`,
  `public-confirmation.component.ts`, `public-context-banner.component.ts`,
  `public-documents.component.ts`, `public-payment.component.ts`,
  `reportes-contables-content.component.ts`, `schedule-grid.component.ts`.
- El script dejó un artefacto cosmético (línea en blanco donde estaba `style=""` vacío, y doble
  espacio en el `style` remanente al reconstruirlo) — limpiado con `prettier --write` + un sed
  acotado a `propname:  ` → `propname: ` en los archivos tocados. Sin impacto funcional (CSS
  ignora espacios extra), solo prolijidad.
- **`public-context-banner.component.ts`** tenía un segundo caso que el script no cubre
  (`border-top`, prop no reconocida por su regex de `border`) — migrado a mano:
  `style="border-top: 1px solid color-mix(in srgb, var(--ds-brand) 15%, transparent);"` →
  clase `border-t border-brand/15` en el `class=""` existente.
- Los archivos con `box-shadow` (`force-password-change.component.ts`,
  `login-card.component.ts`), la prop no estándar `focus-ring-color` en
  `cuadratura-content.component.ts`, y el patrón `var(--pe-brand-400, var(--ds-brand))` con
  fallback anidado en `public-wizard-shell.component.ts` quedaron **intencionalmente sin
  tocar** — el script los marca correctamente como no-mapeables a una clase Tailwind
  1-a-1, y por el criterio de diseño confirmado (ver abajo) no son deuda: son
  `color-mix(var(--token))` válido, solo que expresado en `style` en vez de clase.
- Documentado el criterio de diseño para los 56 archivos de "gap del script" (CSS embebido +
  bindings dinámicos) en `docs/BACKLOG-DEUDA-TECNICA.md` § "Decisiones de diseño cerradas" —
  se cierran sin migrar, ya cumplen la regla real (`color-mix()` solo con `var(--token)`,
  nunca hex/rgb crudo).

## Test de Regresión

- `npm run lint:arch` → exit 0, 0 errores. Ningún warning nuevo proviene de los 10 archivos
  tocados (verificado cruzando cada línea `Archivo:` de los warnings ARCH-11 contra la lista).
- `ng build` → build exitoso, mismo warning preexistente de bundle budget (no relacionado).
- **Verificación visual real con Playwright** (`ng serve` local, `/inscripcion?branchId=1`):
  `PublicContextBannerComponent` (uno de los archivos migrados) renderiza con
  `getComputedStyle` real — `border-brand/30` compiló a `border-color: oklab(... / 0.3)`
  (equivalente visual exacto al `color-mix(in srgb, var(--ds-brand) 30%, transparent)`
  original) y `bg-gradient-primary` + el `box-shadow: color-mix(...)` que quedó inline
  renderizan ambos correctamente (gradiente rojo→naranja, sombra con opacidad de marca).
  Verificación proporcional al riesgo: mismo patrón de clase ya usado en producción desde la
  corrida original de mayo — no se repitió Playwright por cada uno de los 10 archivos.
- `npm run test:ci` (suite completa) → **1651/1654 passed, 3 skipped (pre-existentes), 0
  failed, exit 0.** Sin regresiones.
