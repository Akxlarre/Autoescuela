# Fix: Desactivar un instructor no avisa de sus clases futuras ni de su vehículo asignado
> id: fix-205-b-desactivar-instructor-clases-futuras
> refs: ASG-i-034 (sospecha S9, confirmada en fix-197-b) — decisión del owner 2026-10-07: avisar, no bloquear
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado leyendo el código el 2026-10-07.] Al marcar "Inactivo" en Editar instructor, el drawer
solo dice "impedirá nuevas asignaciones de clases". `update-instructor` bloquea el acceso
(fix-180-b) pero no toca nada más: las clases ya agendadas quedan con un instructor inactivo y la
asignación de vehículo sigue abierta (el vehículo no se ofrece a otro instructor). Nadie se entera.

## ACs Afectados
Ninguno de una spec previa. ACs propios (decisión del owner: **avisar, no bloquear**):
- **F1:** al marcar Inactivo un instructor activo, el aviso dice cuántas clases tiene agendadas a
  futuro (estado `scheduled`, desde ahora) y que hay que reasignarlas desde la Agenda.
- **F2:** si tiene vehículo asignado, el aviso lo dice y sugiere quitarlo para que otro lo use.
- **F3:** el aviso base es fiel: desactivar impide iniciar sesión (fix-180-b) y recibir clases nuevas.
- **F4:** no bloquea: se puede guardar igual.

## Cambio
- `src/app/core/utils/instructor-deactivation.utils.ts` (+ spec) — `instructorDeactivationNotices()`.
- `src/app/core/facades/instructores.facade.ts` (+ spec) — `cargarClasesFuturas(instructorId)` +
  signal `clasesFuturasSeleccionado`.
- `src/app/features/admin/instructores/admin-instructor-editar-drawer.component.ts` — usa ambos.
- `e2e/instructores-desactivar.spec.ts` — verificación en vivo (sin guardar).

## Test de Regresión
- `npx vitest run src/app/core/utils/instructor-deactivation.utils.spec.ts src/app/core/facades/instructores.facade.spec.ts`
- `npx playwright test e2e/instructores-desactivar.spec.ts` (build de prod en :4200)

## Progreso
- [x] `instructor-deactivation.utils.spec.ts` 4/4; `instructores.facade.spec.ts` +3 (conteo, error → null, respuesta vieja descartada con `createRequestGuard`).
- [x] Drawer: el aviso lista base + clases futuras + vehículo; Guardar sigue habilitado (F4). `ng build` ✓, `lint:arch` 0 errores (182, sin nuevas), `test:ci` 254 archivos ✓.
- [x] En vivo como admin, sin guardar: Instructor1 (12 clases a futuro, ABCD43) → los 3 avisos; Instructor2 (0 clases) → sin aviso de clases. e2e 2/2.
