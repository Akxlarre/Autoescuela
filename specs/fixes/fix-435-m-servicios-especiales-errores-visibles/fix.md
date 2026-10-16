# Fix: Servicios especiales no muestra ningún error (ni confirma la venta)
> id: fix-435-m-servicios-especiales-errores-visibles
> refs: fix-429-m-testing-servicios-especiales (S6, casos A07, D08, H04, H05, K12)
> status: in_progress
> created: 2026-10-15

## Root Cause

`ServiciosEspecialesFacade` guarda el motivo de cada falla en `error()`, pero ninguna pantalla lo
lee. Registrar venta, agregar servicio y editar servicio dejan el drawer abierto sin decir nada; el
export solo hace `console.error`. La carga inicial no captura el error: `initialize()` lo deja
escapar, el catálogo queda vacío y la pantalla muestra "Todavía no hay servicios en el catálogo ·
Agregar servicio", lo que invita a duplicar servicios. Tampoco hay confirmación al registrar una
venta: el drawer solo se cierra.

**Decisión de Matías (2026-10-15, H05):** toast "Venta registrada" al guardar.

## ACs Afectados

Ninguno — fix autónomo. ACs propios:

- AC-1: si registrar venta, agregar servicio o editar servicio falla, aparece un toast de error con
  el motivo y el drawer sigue abierto con los datos.
- AC-2: al registrar una venta aparece el toast "Venta registrada"; al agregar o editar un
  servicio, su confirmación.
- AC-3: si el export falla, aparece un toast de error.
- AC-4: si la carga inicial falla, la página muestra "No se pudieron cargar los servicios
  especiales." con un botón "Reintentar", no el estado de catálogo vacío.

## Cambio

- `core/facades/servicios-especiales.facade.ts` — `loadError` + `reintentar()`; `initialize()`
  captura el error de la primera carga; `exportarHistorial()` devuelve si descargó.
- Drawers de registrar venta, agregar y editar servicio — toast de éxito / error.
- `historial-ventas-drawer` — toast si el export falla.
- `servicios-especiales-content` — input `loadError` y output `retry`; Smart de admin y secretaria
  los conectan.

## Test de Regresión

- `servicios-especiales.facade.spec.ts > errores visibles (fix-435-m)` — 5 casos.
