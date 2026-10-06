# Fix: RLS de promociones, cursos y libro de Clase Profesional sin sede ni restricción de rol
> id: fix-321-m-rls-promociones-profesional-sede-y-rol
> refs: fix-319-m-testing-clase-profesional-piloto (S6, D5) · ASG-i-025 · 0047-b
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Root Cause
Las políticas de `professional_promotions`, `promotion_courses` y `class_book`
(`20260301000011_10_rls_policies.sql:489-529,666-676`, + `select_class_book` de
`20260303120000`) solo exigen `auth_user_role() IN ('admin','secretary')`: no filtran por sede y
le dan a la secretaria el mismo CRUD que al admin. `0047-b` las dejó fuera porque "el módulo está
bloqueado en el piloto"; hoy Promociones y Libro de clases están visibles.

Confirmado el 2026-10-05 en la BD de desarrollo: `secretaria@test.com` (sede 1, sin Profesional)
lee 12 promociones, 48 cursos y 25 libros de la sede 2, y **editó y borró** una promoción de la
sede 2.

Decisión D5 (Matías, 2026-10-05): la secretaria **ve y edita datos operativos** (número, nombre…);
**crear, finalizar y cancelar promociones es solo del admin**.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- **Migración nueva** — reescribir las políticas de las 3 tablas (y `promotion_course_lecturers`
  si aplica) con el patrón de `0047-b` (`branch_visible()`): lectura/edición por sede; INSERT y
  DELETE de promociones solo admin; el cambio de `status` a `finished`/`cancelled` solo admin
  (trigger o política). Requiere `fix-320-m` aplicado antes (libros con sede NULL).
- **`src/app/features/admin/profesional-promociones/`** y
  **`src/app/features/secretaria/profesional-promociones/`** — la secretaria no ve "Nueva
  promoción" ni las opciones Finalizada/Cancelada del editor.
- La migración la aplica Matías.

## Test de Regresión
- Por API: secretaria de la sede 1 → 0 filas de la sede 2 en las 3 tablas; UPDATE/DELETE → 0 filas.
- Por API: secretaria de la sede 2 → puede editar nombre/número; no puede INSERT, DELETE ni pasar
  a `finished`/`cancelled`.
- E2E: la secretaria no ve "Nueva promoción".

## Progreso
- [x] Migración `20261005130000_fix321_rls_clase_profesional_sede_y_rol.sql` escrita.
- [x] UI: `PromocionesFacade.canManageLifecycle()`; sin "Programar Promoción" ni Finalizada/Cancelada
  para la secretaria. Unit tests (7 nuevos) en verde, `tsc` y `lint:arch` sin errores.
- [x] Matías aplicó la migración (2026-10-05).
- [x] Regresión por API en verde (17/17), cuentas `secretaria@test.com` (sede 1),
  `secretaria2@test.com` (sede 2), `secretaria.multisede@test.com` y admin, con una promoción
  desechable (id 24, 2099-01-05) borrada al final:
  - sec1 lee 0 promociones / 0 cursos / 0 libros de la sede 2; no edita ni borra la promoción,
    el curso ni el libro de la sede 2.
  - sec2 y multisede leen 12 promociones / 48 cursos / 38 libros de la sede 2.
  - sec2 edita nombre/número, pasa planificada → en curso, edita curso y libro de su sede; **no**
    puede pasar a `finished` ni `cancelled` ("new row violates row-level security policy"), ni
    borrar, ni crear.
- [x] Revisión visual (Playwright, `secretaria2@test.com`, `/app/secretaria/profesional/promociones`):
  el hero no muestra "Programar Promoción"; el editor de la Promoción 280 (en curso) ofrece solo
  "En curso". Consola sin errores.
