# Fix: Badge icono y texto pegados en chips de section-hero
> id: fix-149-m-badge-icono-texto-pegado
> refs: 0008-m-app-like-matriz-notas-evaluaciones
> status: done
> closed: 2026-08-10
> created: 2026-08-10

## Root Cause
Las utilidades `@utility badge-*` (badge-warning, badge-success, badge-error, badge-info,
badge-neutral, badge-brand) en `src/tailwind.css` declaran `display: inline-flex` pero nunca
definieron `gap`. `<app-badge>` proyecta `<app-icon>` + texto como hijos flex directos, así que
quedan pegados sin separación cuando un chip tiene ícono (ej. "En edición", "Cambios sin guardar"
en el hero de la matriz de notas).

## ACs Afectados
Ninguno — fix autónomo (bug visual detectado en QA manual, no ligado a un AC específico).

## Cambio
- **Archivo:** `src/styles/tokens/_variables.scss`
- **Qué cambia:** agrega token `--badge-gap: var(--space-1)`.
- **Archivo:** `src/tailwind.css`
- **Qué cambia:** agrega `gap: var(--badge-gap)` a las 6 utilidades `@utility badge-*`.

## Test de Regresión
- Verificación visual manual: chips "En edición" / "Cambios sin guardar" en
  `evaluaciones-profesional-content` muestran separación entre ícono y texto.
  ✅ Confirmado visualmente por el usuario en navegador real (2026-08-10).
