# Fix: Agregar variant "brand" a app-badge
> id: fix-038-b-app-badge-variant-brand
> refs: fix-036-app-badge-fuente-unica, fix-037-migrar-pills-certificacion-profesional
> status: done
> closed: 2026-07-08
> created: 2026-07-08

## Root Cause
fix-037 detectó que el baseline ARCH-15 tiene una segunda categoría de pills (chips de
rol/marca: "Administrador" en `ajustes-drawer.component.ts`, acción `email_sent` en logs)
que usan `text-brand`/`bg-brand-muted`/`var(--color-primary)` — sin variant equivalente en
`app-badge` (solo success/warning/error/info/neutral, ninguno de marca). Sin este variant,
~15-20 de los 115 pills restantes del baseline no son migrables.

Decisión del usuario: agregar un 6º variant `brand` a `app-badge` en vez de crear un
componente separado (`app-chip`) para estos casos.

## ACs Afectados
Ninguno — fix autónomo (continuación directa de fix-036).

- AC-1: `app-badge` acepta `variant="brand"` (unión de tipo ampliada a `'success' |
  'warning' | 'error' | 'info' | 'neutral' | 'brand'`).
- AC-2: Nueva utilidad `badge-brand` en `tailwind.css` — usa tokens de marca existentes
  (`--color-primary-muted`/`--ds-brand`/`--accent-border`, los mismos que ya usaba el chip
  "Administrador" de `ajustes-drawer.component.ts`), radio/padding desde los tokens de
  Capa 4 (`--badge-radius`/`--badge-padding-*`), igual que las otras 5 utilidades badge-*.
- AC-3: 0 clases muertas (ARCH-11 limpio en `badge.component.ts`), 0 concatenación
  dinámica de clase (mismo gotcha de Tailwind v4 documentado en fix-036).

## Cambio
- **Archivo:** `src/tailwind.css` — nueva utilidad `badge-brand`.
- **Archivo:** `src/app/shared/components/badge/badge.component.ts` — variant `'brand'`
  agregado al union type y al `switch` de `badgeClass()`.
- **Archivo:** `indices/STYLES.md` — documentar el 6º variant.

## Test de Regresión (ejecutado — todo verde)
- 0 clases muertas en `badge.component.ts` (ARCH-11) ✅ (AC-3)
- `npm run lint:arch` → exit 0 ✅; `ng build` → exit 0 ✅
- Playwright: `badge-brand` presente en el stylesheet servido (recorrido recursivo de
  `@layer`, 1 regla) — confirma que el string literal en el `switch` evita el gotcha de
  poda de Tailwind v4 (fix-036) ✅ (AC-1, AC-2, AC-3)
- Computed styles dark: `bg rgba(56,189,248,0.15)` / `color rgb(56,189,248)` (sky-400);
  light: `bg rgba(14,165,233,0.08)` / `color rgb(14,165,233)` (sky-500) — coinciden con
  `--ds-brand` en ambos modos, radio `9999px`, padding `4px 12px` ✅ (AC-2). Consola: 0 errores.
- `indices/STYLES.md` documenta el 6º variant y su regla de uso (rol/marca, no estado)
