# Fix: Migrar pills de estado a app-badge — certificacion-profesional-content
> id: fix-037-b-migrar-pills-certificacion-profesional
> refs: fix-036-app-badge-fuente-unica (usa su resultado)
> status: done
> closed: 2026-07-08
> created: 2026-07-08

## Root Cause
Primer lote de la migración de ~122 pills ad-hoc (baseline ARCH-15,
`docs/BACKLOG-DEUDA-TECNICA.md` fase 4) hacia `<app-badge>` (fuente única desde fix-036).

Hallazgo durante el triage: los 122 NO son homogéneos. Hay dos categorías:
1. **Indicadores de estado** (la mayoría) — usan literalmente `--state-success/warning/info`
   o helpers `getXColor()/getXBg()` con umbrales que retornan esos mismos tokens. Mapean
   1:1 a los variants de `app-badge`.
2. **Chips de rol/marca** (ej. `ajustes-drawer.component.ts`: "Administrador" con
   `text-brand`/`bg-brand-muted`; `certificacion-clase-b-content.component.ts`: acción
   `email_sent` con `var(--color-primary)`) — NO tienen variant equivalente en `app-badge`
   (que solo tiene success/warning/error/info/neutral, sin "brand"). Migrarlos exigiría
   una decisión de diseño nueva (agregar 6º variant vs. dejarlos como están) — fuera de
   scope de este fix, queda anotado en el backlog para decisión del usuario.

Este fix cubre SOLO categoría 1, empezando por `certificacion-profesional-content.component.ts`
(8 pills, 100% estado, sin ambigüedad — 3 pares dinámicos con helpers de 2-3 umbrales +
2 pares estáticos con `class` duplicado, que ya era un anti-patrón en sí mismo).

Bonus fix de paso: los helpers usaban tokens inexistentes (`--bg-success-muted`,
`--bg-warning-muted`, `--bg-info-muted`, con fallback hardcodeado a rgba) en vez de los
tokens reales `--state-{success,warning,info}-bg`. Al migrar a `<app-badge>` esto se
resuelve automáticamente (el componente usa los tokens reales).

## ACs Afectados
Ninguno — fix autónomo (fase 4 del roadmap, primer lote de migración).

- AC-1: Los 8 pills de `certificacion-profesional-content.component.ts` (teoría, práctica,
  nota, pago, certificado) se reemplazan por `<app-badge [variant]="...">` con la misma
  lógica de umbral que tenían los helpers (ahora expresada como variant en vez de estilo).
- AC-2: Los helpers `getTeoriaBg/Color`, `getPracticaBg/Color`, `getNotaBg/Color` se
  eliminan (ya no se necesitan — el color lo resuelve `app-badge` según variant).
- AC-3: Icono decorativo condicional (`alert-triangle`, `x-circle`, `check`) se preserva
  como `<ng-content>` dentro de `<app-badge>`.
- AC-4: `npm run lint:arch` sin regresión ARCH-15 en este archivo (ratchet baseline baja).
- AC-5: Verificación visual: mismos colores/umbrales que antes de migrar (no debe cambiar
  el comportamiento visual, solo la implementación).

## Cambio
- **Archivo:** `src/app/shared/components/certificacion-profesional-content/certificacion-profesional-content.component.ts`
  — 8 pills → `<app-badge>`, import del componente, eliminación de 6 métodos helper.

## Test de Regresión (ejecutado — todo verde)
- Grep directo confirma 0 pills ad-hoc de mi scope restantes en el archivo (el único
  `rounded-full` que queda es el pill de "acción" del log, categoría 2, fuera de scope) ✅
- `npm run lint:arch` → exit 0, backlog ARCH-15 bajó 308→301 (ratchet), consolidado con
  `--update-ds-baseline`: **ARCH-15 122 → 115** ✅ (AC-4)
- `ng build` → exit 0 ✅
- Playwright con **datos reales** (promoción SEED, curso A2, 30 alumnos): los 3 variants
  dinámicos renderizan correctamente — `badge-success` (24×, ej. 100% práctica),
  `badge-warning` (5×, "Pendiente"), `badge-info` (1×, 80% práctica — confirma el umbral
  75-99 de 3 niveles). Consola: 0 errores. Captura:
  `fix037-certificacion-profesional-badges.png` (.playwright-mcp) ✅ (AC-1, AC-5)
- AC-2 (helpers eliminados) y AC-3 (ícono condicional preservado en `<ng-content>`)
  confirmados por lectura directa del diff ✅
