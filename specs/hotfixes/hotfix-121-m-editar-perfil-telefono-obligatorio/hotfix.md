# Hotfix: "Editar Perfil" deja guardar un alumno sin teléfono
> id: hotfix-121-m-editar-perfil-telefono-obligatorio
> refs: fix-264-m (caso M08 de `024b`), ASG-i-024
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
En "Editar Perfil" de la ficha el teléfono es opcional y no tiene mínimo: se puede guardar vacío o con dos dígitos. En Nueva Matrícula (wizard de la secretaria) ese mismo dato es obligatorio y exige al menos 8 caracteres (`personal-data.component.ts`: `d.phone.trim().length >= 8`), así que un alumno puede quedar con un teléfono que el wizard no habría aceptado.

**Decisión del owner (Matías, 2026-10-01):** no agregar una validación de formato nueva; copiar la regla de Nueva Matrícula.

## Cambios
- **Archivo:** `src/app/core/utils/phone.utils.ts` — función pura `hasMinimumPhoneLength(phone)`: al menos 8 caracteres sin contar espacios al inicio y al final. Es la regla del wizard, escrita una vez.
- **Archivo:** `src/app/features/admin/alumno-detalle/editar-perfil-drawer/admin-editar-perfil-drawer.component.ts` — el control `phone` usa esa regla; el campo se marca obligatorio y muestra el mensaje de error.

El wizard de Nueva Matrícula no se toca.

## Verificación
Verificado el 2026-10-01: `phone.utils.spec.ts > hasMinimumPhoneLength` (10 casos) y `admin-editar-perfil-drawer.component.spec.ts > teléfono — hotfix-121-m` (5 tests) en verde. En navegador siguen pasando M01 · M03 · M06 · M07, M02 y C04, que guardan el perfil con un teléfono válido.

Cierre de la tanda de la ficha (fix-272-m, fix-273-m, hotfix-120-m, hotfix-121-m): `npx vitest run` (2900 tests), `npm run lint:arch` (0 errores) y los dos archivos E2E de Alumnos B (50/50 esperados) en verde.

**Efecto a tener presente:** un alumno que hoy no tiene teléfono guardado (o tiene menos de 8 caracteres) no se puede editar sin completarlo.
