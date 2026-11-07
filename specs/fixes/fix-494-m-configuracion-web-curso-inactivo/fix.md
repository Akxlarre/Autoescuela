# Fix: Configuración web — una card de curso desactivado dice "Curso no existe"
> id: fix-494-m-configuracion-web-curso-inactivo
> refs: ASG-i-036
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

`CoursesFacade.loadAvailableCourses()` traía solo los cursos con `active = true`. En la pestaña
Cursos & Precios, una card cuyo curso se desactivó en el catálogo no encontraba su curso y caía
en la rama "huérfana": borde rojo, "(curso no disponible)" y badge "Curso no existe". La
advertencia correcta, "Curso inactivo — no visible en web", nunca podía mostrarse (S17 / L10 de
`fix-485-m`, contra AC4 de `0004-b`).

## ACs Afectados

- `0004-b` AC4: la card de un curso desactivado se marca como inactiva, no como inexistente.

## Cambio

- **`core/facades/courses.facade.ts`:** carga todo el catálogo de la sede (activos e inactivos).
  `availableCourses` y `availableById` siguen siendo solo los activos (lo que se puede elegir y lo
  que se publica); `catalogById` incluye los inactivos para reconocerlos.
- **`features/admin/configuracion-web/tabs/cursos-tab.component.ts`:** busca el curso de cada card
  en `catalogById`.

## Test de Regresión

- `core/facades/courses.facade.spec.ts > fix-494-m` ✓
- Navegador (catálogo interceptado con `page.route`, SENCE marcado inactivo): la card dice "Curso inactivo — no visible en web" ✓ (captura `c485-15-curso-inactivo.png`)
