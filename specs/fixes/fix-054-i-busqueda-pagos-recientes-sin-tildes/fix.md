# Fix: La búsqueda de Pagos Recientes no encuentra nombres con tildes o ñ si se escriben sin ellas
> id: fix-054-i-busqueda-pagos-recientes-sin-tildes
> refs: fix-048-i-testing-pagos-y-descuentos (B3-3, caso J04)
> status: done
> closed: 2026-10-15
> created: 2026-10-15

## Root Cause

`PagosRecientesDrawerComponent.pagosFiltrados` compara con `toLowerCase().includes()`, sin quitar
tildes: "munoz" no encuentra "Muñoz" ni "perez" a "Pérez". El resto de la app usa
`matchesSearchTokens()` (`core/utils/search-filter.utils.ts`), que ignora tildes y ñ, acepta
nombre y apellido en cualquier orden y compara RUT sin puntuación; el selector de "Registrar Pago"
ya ignora tildes.

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-048-i` B3-3). Criterios de este fix:

- **AC-F1:** "munoz" encuentra "Muñoz" y "perez" encuentra "Pérez".
- **AC-F2:** la búsqueda por N° de boleta y los filtros de estado y método siguen igual.

## Cambio

- **Archivo:** `src/app/features/admin/pagos/pagos-recientes-drawer.component.ts`
- **Qué cambia:** `pagosFiltrados` busca con `matchesSearchTokens([alumno, nroDocumento], query)`.

## Test de Regresión

- `src/app/features/admin/pagos/pagos-recientes-drawer.component.spec.ts` (sin tildes y sin ñ).

## Verificación

- 2026-10-15: spec 10/10, `tsc` limpio, `lint:arch` 0 errores. QA Playwright como secretaria:
  buscar "munoz" en Pagos Recientes muestra "Reyes Muñoz Camila Andrea" y "Muñoz Vega Carlos
  Eduardo".
