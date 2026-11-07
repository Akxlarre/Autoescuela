# Fix: Configuración web ofrece cursos que la web pública nunca muestra
> id: fix-499-m-configuracion-web-cursos-no-publicables
> refs: fix-485-m-testing-auditoria-configuracion-web
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

Visto en Q02 de `fix-485-m`: se publicó una card con "Refuerzo Clase B" y la landing la descartó
en silencio (SSR: "Cards resueltas: 2/3").

La policy `select_courses_anon` (migración `20260808130000`) oculta a propósito al visitante los
cursos de **Refuerzo** y de **Convalidación**: la landing no los recibe y descarta la card. Pero
Configuración web arma su desplegable con `CoursesFacade.availableCourses` (todos los activos de
la sede), así que la secretaria puede publicar una card que nunca aparecerá, sin ningún aviso.

## ACs Afectados

- `0004-b` AC1/AC4 (el desplegable solo ofrece lo que la web puede mostrar; una card que no se
  verá se marca).

## Cambio

- `core/facades/courses.facade.ts`: el catálogo trae `is_convalidation` e `is_reinforcement`;
  `webCourses` = activos que no son refuerzo ni convalidación (`availableCourses` no cambia: lo
  usa también el drawer de precios del admin).
- `features/admin/configuracion-web/tabs/cursos-tab.component.ts`: desplegable, botón "Agregar" y
  estado vacío usan `webCourses`; una card existente con un curso de refuerzo o convalidación se
  marca "No se publica en la web".

## Test de Regresión

- `core/facades/courses.facade.spec.ts > fix-499-m` ✓ (31/31 junto a website-config y configuración web/precios).
- Navegador (2026-11-07, admin, sede 1): el desplegable de una card nueva ofrece "Clase B (B)" y "Clase B SENCE (B)"; ya no "Refuerzo Clase B".
