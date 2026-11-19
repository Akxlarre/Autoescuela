# Hotfix: Los drawers de anticipo conservan un instructor de otra sede
> id: hotfix-189-b-instructor-otra-sede-drawers-anticipo
> refs: —
> status: done
> created: 2026-11-18

## Problema
Al cambiar de sede con Registrar Anticipo o Registrar Egreso (tipo anticipo) abierto, el formulario
conserva `instructorId`: el selector se ve vacío, pero el formulario sigue válido y se puede guardar
un anticipo para un instructor de la otra sede.

Además, Registrar Egreso abierto fuera de la página de Anticipos no recargaba la lista al cambiar de
sede: seguía ofreciendo los instructores de la sede anterior.

## Cambios
- **Archivo:** `src/app/core/utils/instructor-anticipo.utils.ts` — regla pura: bloqueado, sin elegir, vigente o fuera de lista
- **Archivo:** `src/app/features/admin/contabilidad-anticipos/vincular-instructor-anticipo.ts` — conecta la regla al campo del formulario
- **Archivo:** `src/app/features/admin/contabilidad-anticipos/registrar-anticipo-drawer.component.ts` — usa la regla compartida
- **Archivo:** `src/app/features/admin/contabilidad-cuadratura/registrar-egreso-drawer.component.ts` — la usa solo en el tipo anticipo y recarga instructores al cambiar de sede
