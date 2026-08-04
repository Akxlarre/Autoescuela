# Fix: Regresión ratchet ARCH-19 — tipografía recompuesta a mano en `audit-log-detail-drawer`
> id: fix-111-b-tipografia-adhoc-audit-log-drawer
> refs: indices/DS-AUDIT-2026-08-03.md (H5)
> status: done
> closed: 2026-08-03
> created: 2026-08-03

## Root Cause

`npm run lint:arch` reporta `[ARCH-19] Cluster tipográfico ad-hoc (ratchet)`: 4 casos en
`audit-log-detail-drawer.component.ts` donde se recompuso a mano una clase que ya existe en el
vocabulario tipográfico del DS (`.claude/rules/visual-system.md` §Vocabulario tipográfico), en
vez de usarla directamente. La cuota baseline del ratchet es 0 — cualquier caso nuevo es
regresión, no deuda heredada (a diferencia del backlog de fix-078-b, que sí tenía baseline > 0).

- Líneas 17, 58, 70: `text-xs font-semibold uppercase tracking-wide text-text-muted` →
  reemplazo exacto de `.overline`.
- Línea 62: `text-sm font-semibold text-text-primary` → reemplazo exacto de `.item-title`.

## ACs Afectados

Ninguno — fix autónomo de disciplina de clases (ratchet ARCH-19), sin AC de spec previa.

## Cambio

- **Archivo:** `src/app/features/admin/auditoria/audit-log-detail-drawer.component.ts`
- **Qué cambia:** las 4 clases recompuestas a mano se reemplazan por `.overline` (líneas 17, 58,
  70) y `.item-title` (línea 62). Cero cambio visual esperado — son las mismas propiedades CSS
  bajo un nombre semántico, ya usadas en decenas de archivos del proyecto.

## Test de Regresión

Resultado (2026-08-03):

- `npm run lint:arch` — el hallazgo `[ARCH-19]` desapareció por completo (170→169 advertencias
  totales, 0 errores; ningún otro hallazgo nuevo) ✓
- `npx ng build` — compiló sin errores (42s, único warning es el budget de bundle pre-existente,
  no relacionado) ✓
