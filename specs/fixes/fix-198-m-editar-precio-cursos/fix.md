# Fix: Editar el precio de cursos existentes desde Ajustes del Admin
> id: fix-198-m-editar-precio-cursos
> refs: —
> status: done
> closed: 2026-08-21
> created: 2026-08-21

## Root Cause
`courses.base_price` alimenta el pricing de matrícula (`enrollment-payment.facade.ts`),
landing pages (`website-config.facade.ts`), promociones (`promociones.facade.ts`) y el
picker de cursos de Configuración Web (`cursos-tab.component.ts`) — todo lo lee read-only.
`CoursesFacade` (`core/facades/courses.facade.ts`) solo tiene `loadAvailableCourses()`
(SELECT); el único `.update()` sobre la tabla `courses` en todo el proyecto es
`AdminHorariosFacade.updateScheduleBlocks()`, que toca `schedule_blocks`, no `base_price`.
No existe ninguna pantalla de administración del "Catálogo Operacional" (el propio texto
de `cursos-tab.component.ts` lo menciona como si existiera: "Primero crea cursos en el
Catálogo Operacional...", pero esa pantalla nunca se construyó). Los precios solo
existen porque se cargaron directo en la BD vía seed/migración — para cualquier ajuste de
tarifa (ej. alza de precio anual), hoy se requiere una migración SQL manual.
Gap detectado en conversación con el dueño, no ligado al UAT.

## ACs Afectados
Ninguno — fix autónomo.

- AC-1: Admin puede ver, en Ajustes, la lista de cursos activos de la sede seleccionada
  (o de todas si "Todas las escuelas") con su precio actual.
- AC-2: Admin puede editar el `base_price` de un curso existente y guardar el cambio.
- AC-3: El cambio se refleja de inmediato en `CoursesFacade.availableCourses()` (mismo
  signal que ya consume Configuración Web) sin necesitar recargar la página.
- AC-4: Secretaria/instructor NO tienen acceso a esta sección — vive solo en Ajustes del
  Admin, junto a "Descuentos Predefinidos" y "Grilla Horaria Base".
- AC-5: Fuera de alcance — crear cursos nuevos, desactivar/eliminar cursos, editar otros
  campos del curso (nombre, horas, license_class). Solo el precio.

## Cambio
- **Archivo:** `core/facades/courses.facade.ts` — agregar `updateBasePrice(courseId, price)`
  que hace `UPDATE courses SET base_price = ...` y actualiza `_availableCourses` en memoria
  (mismo patrón que `AdminHorariosFacade.updateScheduleBlocks()`).
- **Archivo:** componente nuevo en `features/admin/configuracion-precios/` — drawer con lista
  de cursos + edición inline de precio, empujado desde Ajustes (`ajustes-drawer.component.ts`)
  vía `LayoutDrawerFacadeService`, mismo patrón que `DescuentosDrawerComponent`.
- **Archivo:** `indices/FACADES.md` / `indices/COMPONENTS.md` — se auto-actualizan con
  `npm run indices:sync`.

## Test de Regresión
- `courses.facade.spec.ts` (nuevo o extendido) — `updateBasePrice()` llama a Supabase con el
  `id` y `base_price` correctos, y refleja el nuevo valor en `availableCourses()` tras éxito;
  en error, reporta via toast y no muta el estado local.
- Verificación manual: editar el precio de un curso de Clase B en Ajustes → abrir matrícula
  para ese curso → el nuevo precio aparece en el pricing breakdown del step de pago.
