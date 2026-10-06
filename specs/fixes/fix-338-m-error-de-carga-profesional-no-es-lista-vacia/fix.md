# Fix: Un error de carga en la Base Profesional o en Promociones no se muestra como lista vacía
> id: fix-338-m-error-de-carga-profesional-no-es-lista-vacia
> refs: ASG-i-025 · fix-319-m (F07 · S14 · S16) · patrón de hotfix-113-m / fix-287-m
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Root Cause

Ni la Base Profesional ni Promociones distinguen "la carga falló" de "no hay datos" (F07,
verificado el 2026-10-06 abortando las consultas):

- **Base Profesional:** `AdminAlumnosProfesionalFacade` sí guarda el error en `error()`, pero
  `app-alumnos-profesional-list-content` no lo recibe: muestra "No hay alumnos profesionales ·
  Limpiar filtros".
- **Promociones:** `PromocionesFacade.initialize()` no tiene `catch`: la promesa queda rechazada
  sin manejar, `error()` nunca se llena y `_initialized` queda en `true`, así que tampoco hay
  reintento con skeleton. La página muestra "No se encontraron promociones · Limpiar Filtros".

Mismo patrón que la Base B ya corrigió (hotfix-113-m) y Ex-Alumnos B (fix-287-m).

Además (S16, misma pantalla): los Smart de la Base Profesional (admin y secretaria) llaman
`initialize()` en `ngOnInit` **y** en el `effect` de sede → dos consultas idénticas al entrar
(vistas en la red el 2026-10-06); el facade no tiene guard de orden. Es el caso que hotfix-055-b
corrigió en Pre-inscritos: el `effect` ya hace la carga inicial.

## ACs Afectados

Ninguno de spec — fix autónomo derivado del testing de `fix-319-m`. Cierra:

- **F07 / S14:** si la carga falla y no hay datos, la Base Profesional y Promociones muestran el
  error con "Reintentar" (no "lista vacía · Limpiar filtros"); "Reintentar" vuelve a cargar.
- **S16:** al entrar a la Base Profesional se consulta la lista una sola vez.

## Cambio

- **`shared/components/alumnos-profesional-list-content/…component.ts`**: input `error`,
  `showLoadError` y el estado de error con "Reintentar" (emite `refreshRequested`), igual que
  `app-alumnos-list-content`.
- **`features/admin/alumnos-profesional/…component.ts`** y
  **`features/secretaria/alumnos-profesional/…component.ts`**: pasan `facade.error()`; quitan la
  llamada duplicada a `initialize()` de `ngOnInit` (la hace el `effect`).
- **`core/facades/promociones.facade.ts`**: `initialize()` captura el error, lo expone en
  `error()` y no marca inicializado (reintentar vuelve a cargar con skeleton); una carga correcta
  limpia el error.
- **`features/admin/profesional-promociones/…component.ts`**: `showLoadError` y el estado de
  error con "Reintentar" (la página de secretaria reutiliza este componente).

## Test de Regresión

- `promociones.facade.spec.ts > error de carga (fix-338-m)` ✓
- `alumnos-profesional-list-content.component.spec.ts > error de carga (fix-338-m)` ✓
- `admin-alumnos-profesional.component.spec.ts > carga una sola vez al entrar (fix-338-m)` ✓
- Navegador: consultas abortadas → error + Reintentar en ambas pantallas; con red, Reintentar
  carga; al entrar a la Base Profesional, 1 consulta de `enrollments` ✓
- `admin-profesional-promociones.component.spec.ts > showLoadError (fix-338-m)` ✓ (agregado al
  implementar)

### Verificación (2026-10-06)

- Tests: 8 nuevos (7 en rojo antes del cambio; el de la página de Promociones se escribió junto
  con su `computed`). Suite completa 3334 ✓. `tsc` sin errores; `lint:arch` 0 errores.
- Navegador (admin, 1440 px):
  - Base Profesional por el menú → **1** consulta de la lista (antes 2).
  - Consultas a `enrollments` y `professional_promotions` abortadas + recarga: la Base muestra
    "Error al cargar alumnos profesionales · No se pudo obtener la lista… · Reintentar";
    Promociones "No se pudieron cargar las promociones · Reintentar". Con la red de vuelta,
    "Reintentar" carga 64 matrículas / 5 promociones.
  - Consola: solo los `ERR_INTERNET_DISCONNECTED` provocados; ya no queda la promesa rechazada
    sin manejar de Promociones.
