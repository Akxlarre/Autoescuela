# Fix: Migrar pills a app-badge — certificacion-clase-b-content
> id: fix-040-b-migrar-pills-certificacion-clase-b
> refs: fix-036-app-badge-fuente-unica, fix-038-app-badge-variant-brand
> status: done
> closed: 2026-07-08
> created: 2026-07-08

## Root Cause
Cuarto lote de la migración de pills ad-hoc del baseline ARCH-15 (fase 4,
`docs/BACKLOG-DEUDA-TECNICA.md`). `certificacion-clase-b-content.component.ts` tiene 4
spans en el baseline, 3 badges reales:
1. Chip "curso" (`alumno.curso`) — estático, `bg-brand-muted text-brand` → `variant="brand"`.
2. Estado de certificado (generado/pendiente) — mismo patrón que fix-037 (2 ramas
   mutuamente excluyentes, `class` duplicado en el mismo elemento, anti-patrón previo).
3. Log de acción (`entry.accion`) — dinámico, 4 casos vía `getAccionBg/Color(accion)`:
   `generated`→success, `email_sent`→**brand** (el caso bloqueado hasta fix-038),
   `downloaded`→info, `printed`/default→neutral.

Mismo bonus de fix-037: los helpers usan tokens inexistentes (`--bg-success-muted`,
`--bg-info-muted`, fallback hardcodeado a rgba) que se resuelven al pasar por `app-badge`.

## ACs Afectados
Ninguno — fix autónomo (fase 4 del roadmap, cuarto lote de migración).

- AC-1: Los 3 badges (curso, certificado, acción) se reemplazan por `<app-badge
  [variant]="...">` preservando la lógica de color/umbral existente.
- AC-2: `getAccionColor`/`getAccionBg` se eliminan; `getAccionLabel` se mantiene (sigue
  siendo necesario para el texto) y gana un helper hermano `getAccionVariant(accion)` que
  retorna el variant literal.
- AC-3: `npm run lint:arch` sin regresión ARCH-15 en este archivo (baseline baja de 4 a 0).
- AC-4: Verificación visual con datos reales: los 4 casos de `accion` (generated,
  email_sent, downloaded, printed) renderizan con el variant/color correcto.

## Cambio
- **Archivo:** `src/app/shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component.ts`
  — 3 badges → `<app-badge>`, import del componente, `getAccionColor`/`getAccionBg`
  eliminados y reemplazados por `getAccionVariant`.

## Test de Regresión (ejecutado — todo verde)
- 0 clases muertas (ARCH-11), 0 referencias huérfanas a los helpers eliminados ✅
- `npm run lint:arch` → exit 0; baseline ARCH-15 consolidado **111 → 107** (los 4 de este
  archivo) ✅ (AC-3)
- `ng build` → exit 0 (warning de bundle budget pre-existente, no relacionado) ✅
- Playwright con **datos reales** (`/app/admin/certificacion`, 26 badges): `badge-brand`
  ×13 ("Clase B", chip de curso), `badge-warning` ×10 ("Pendiente"), `badge-success` ×3
  ("Generación", log de acción). **Caso clave confirmado:** "Envío Email" (accion
  `email_sent`) → `badge-brand`, `rgb(56,189,248)` — el caso exacto que motivó fix-038 ✅
  (AC-1, AC-2, AC-4). Consola: 0 errores. Captura:
  `fix040-certificacion-clase-b-badges.png` (.playwright-mcp)
