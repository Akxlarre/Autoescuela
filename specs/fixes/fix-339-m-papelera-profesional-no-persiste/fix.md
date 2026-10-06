# Fix: La Papelera de la Base Profesional no queda abierta al volver
> id: fix-339-m-papelera-profesional-no-persiste
> refs: ASG-i-025 · fix-319-m (G06) · patrón de hotfix-112-m
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Root Cause

`AdminAlumnosProfesionalFacade` es un singleton y guarda `trashView` entre navegaciones. Al salir
de la Base Profesional estando en la Papelera y volver por el menú, se abre de nuevo la Papelera
(G06, verificado el 2026-10-06: Papelera → Promociones → Base Alumnos Prof.). La Base B tuvo el
mismo problema y lo corrigió hotfix-112-m con `leaveTrashView()` al destruir la pantalla; la Base
Profesional quedó fuera (`fix-276-m` dejó anotado que su Papelera no se había revisado).

## ACs Afectados

Ninguno de spec — fix autónomo derivado del testing de `fix-319-m`. Cierra:

- **G06:** al volver a la Base Profesional se abre la lista activa, no la Papelera.

## Cambio

- **`core/facades/admin-alumnos-profesional.facade.ts`**: `leaveTrashView()` — apaga la
  Papelera sin consultar la BD e invalida la caché para que la próxima entrada cargue la lista
  activa (idéntico a `AdminAlumnosFacade.leaveTrashView`).
- **`features/admin/alumnos-profesional/…component.ts`** y
  **`features/secretaria/alumnos-profesional/…component.ts`**: lo llaman al destruirse.

## Test de Regresión

- `admin-alumnos-profesional.facade.spec.ts > leaveTrashView (fix-339-m)` ✓
- `admin-alumnos-profesional.component.spec.ts > al salir abandona la Papelera (fix-339-m)` ✓
- Navegador: Papelera → Promociones → Base Alumnos Prof. abre la lista activa ✓

### Verificación (2026-10-06)

- Tests: 3 nuevos en rojo antes del cambio, en verde después. Suite completa 3337 ✓. `tsc` y
  `lint:arch` sin errores.
- Navegador (admin): Base Prof. → Papelera ("Papelera — Alumnos profesionales archivados") →
  Promociones (menú) → Base Alumnos Prof. (menú) → "Listado de alumnos de Clase Profesional",
  64 matrículas.
