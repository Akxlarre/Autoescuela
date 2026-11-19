# Fix: Aviso de refresco fallido (caso B) compacto en pagos y reportes
> id: fix-254-b-aviso-refresco-fallido-compacto
> refs: 0060-b-lecturas-fallidas-como-ceros (alturas medidas en la validación T1.6)
> status: done
> closed: 2026-11-19
> created: 2026-11-19

## Root Cause
El aviso del caso B usa `app-alert-card` con su forma de nota: padding de `.card` (24 px), título
arriba y texto + "Reintentar" en otra fila. Mide 126 px y, como va dentro de la celda `.bento-fill`
(alto fijo en desktop), ese alto sale de la lista. A 1440x900 la lista de pagos baja de 310 a 168 px
en admin y de 381 a 239 px en secretaria; cada panel de Reportes baja de 258 a 116 px.

## ACs Afectados
Ninguno de 0060-b cambia: el aviso sigue dentro de `.bento-fill`, primer hijo `shrink-0`, con
`data-llm-action` en "Reintentar".

- AC-1: `app-alert-card` acepta `compact` (default `false`): una sola franja, ícono + título + texto
  + acción proyectada con `[alertAction]`, padding reducido. Sin `compact` se ve igual que hoy.
- AC-2: `admin-pagos`, `secretaria-pagos` y `reportes-contables-content` usan el aviso compacto,
  con "Reintentar" dentro del aviso y su `data-llm-action` intacto.
- AC-3: a 1440x900, en claro y oscuro, el aviso mide alrededor de 56 px y la lista gana alto
  respecto de las mediciones de T1.6 (admin 168, secretaria 239, reportes 116 px).
- AC-4: `.claude/rules/swr-pattern.md` indica la forma compacta para el caso B dentro de `.bento-fill`.

## Cambio
- **Archivo:** `src/app/shared/components/alert-card/alert-card.component.ts` — input `compact` y
  ranura `[alertAction]`.
- **Archivo:** `src/app/features/admin/pagos/admin-pagos.component.ts`,
  `src/app/features/secretaria/pagos/secretaria-pagos.component.ts`,
  `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.ts` —
  aviso del caso B en forma compacta.
- **Archivo:** `.claude/rules/swr-pattern.md`, `indices/COMPONENTS.md`.

## Test de Regresión
- `admin-pagos.component.spec.ts`, `secretaria-pagos.component.spec.ts`,
  `reportes-contables-content.component.spec.ts`: el aviso del caso B es compacto y "Reintentar"
  va en su ranura de acción.

## Progreso
- [x] AC-1, AC-2, AC-4 implementados.
- [x] Test de regresión verde (2026-11-19): `admin-pagos` 30/30, `secretaria-pagos` 27/27 y
  `reportes-contables-content` en verde con `npx vitest run`; `npm run lint:arch:strict` con 0 errores.
- [x] AC-3 admin-pagos (1440x900, claro y oscuro; `rest.fetch` parcheado solo en la pestaña, con escrituras bloqueadas): el aviso mide 57 px (69 px con su envoltorio). La lista pasa de 310 px sin aviso a 241 px con él; antes quedaba en 168 px. No hay scroll de página. El botón mantiene su tamaño (ARCH-16 prohíbe `py-*` sobre `btn-*`); los 57 px salen del padding vertical `--space-1` del aviso, mientras que con `--space-2` medía 65 px.
- [x] AC-3 reportes (admin, 1440x900, claro y oscuro, mismo método): el aviso mide 57 px. Cada panel pasa de 258 px sin aviso a 189 px con él; antes quedaba en 116 px. No hay scroll de página.
- [x] AC-3 secretaria-pagos (sesión de secretaria, 1440x900, claro y oscuro, mismo método): el aviso mide 57 px. La lista pasa de 381 px sin aviso a 312 px con él; antes quedaba en 239 px. Se ven 4 filas. No hay scroll de página.
- Límite: no hay spec propio del modo `compact` de `app-alert-card`. Los `input()` de signal no se
  compilan en JIT sin el plugin de Angular, el mismo motivo por el que `alert-card.component.spec.ts`
  está excluido en `vitest.config.ts`.
