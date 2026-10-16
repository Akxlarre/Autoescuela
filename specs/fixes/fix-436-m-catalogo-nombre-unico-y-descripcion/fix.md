# Fix: El catálogo acepta nombres repetidos o de solo espacios, y no deja editar la descripción
> id: fix-436-m-catalogo-nombre-unico-y-descripcion
> refs: fix-429-m-testing-servicios-especiales (D03, D05, E07, S16) · fix-240-m
> status: in_progress
> created: 2026-10-15

## Root Cause

Los formularios del catálogo validan solo con `Validators.required`, que acepta un texto de solo
espacios, y nada impide crear un servicio con el mismo nombre que otro (ni en la pantalla ni en la
BD). El drawer de editar (`fix-240-m`) se armó con nombre, precio y estado: la descripción solo se
puede escribir al crear.

**Decisiones de Matías (2026-10-15):** D05 — no se permiten dos servicios con el mismo nombre (sin
distinguir mayúsculas); si el duplicado está inactivo, se sugiere reactivarlo. E07 — el drawer de
editar permite cambiar la descripción.

## ACs Afectados

Ninguno — fix autónomo. ACs propios:

- AC-1: crear o renombrar un servicio con el nombre de otro (sin distinguir mayúsculas ni espacios
  de más) muestra un error y no guarda; si el otro está inactivo, el mensaje sugiere reactivarlo.
- AC-2: la BD también lo rechaza (índice único sobre el nombre normalizado).
- AC-3: un nombre o descripción de solo espacios deja el botón deshabilitado; lo guardado va sin
  espacios alrededor.
- AC-4: el drawer de editar muestra y guarda la descripción.

## Cambio

- `core/utils/servicios-especiales.utils.ts` (nuevo) — `buscarServicioDuplicado`,
  `mensajeServicioDuplicado`, validador `noSoloEspacios`.
- `core/facades/servicios-especiales.facade.ts` — `agregarServicio()`/`editarServicio()` recortan
  espacios, rechazan duplicados (también el `23505` de la BD) y `editarServicio()` guarda la
  descripción.
- `agregar-servicio-drawer` y `editar-servicio-drawer` — validador `noSoloEspacios`; editar gana el
  campo Descripción.
- `supabase/migrations/20261015160000_fix436_catalogo_nombre_unico.sql` — índice único
  `lower(btrim(name))`.

## Test de Regresión

- `core/utils/servicios-especiales.utils.spec.ts` (nuevo).
- `servicios-especiales.facade.spec.ts > catálogo: nombre único y descripción (fix-436-m)`.
