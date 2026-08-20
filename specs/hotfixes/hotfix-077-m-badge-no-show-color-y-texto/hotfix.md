# Hotfix: Badge de estado "no_show" con color verde/muted engañoso y texto ambiguo
> id: hotfix-077-m-badge-no-show-color-y-texto
> refs: —
> status: done
> closed: 2026-08-20
> created: 2026-08-19

## Problema
En "Mis Clases de Hoy" (instructor), una clase marcada `no_show` por el cron de las 21:00
se muestra con badge de texto "Falta" en color verde (semánticamente confuso — verde
comunica éxito, no ausencia) y con un texto ambiguo.

## Cambios
- **Archivo:** `src/app/core/facades/instructor-clases.facade.ts` — `colorMap.no_show`:
  `'muted'` → `'warn'` (valor real que reconoce `p-tag` de PrimeNG 21 para severidad de
  advertencia — `'warning'` no existe en su enum y cae al estilo default);
  `labelMap.no_show`: `'Falta'` → `'Ausente'`.
