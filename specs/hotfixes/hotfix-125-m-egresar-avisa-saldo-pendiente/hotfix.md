# Hotfix: "Marcar como Ex-Alumno" no avisa que el alumno tiene saldo pendiente
> id: hotfix-125-m-egresar-avisa-saldo-pendiente
> refs: fix-264-m (caso O05 de `024b`), fix-012-i, ASG-i-024
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
La confirmación de "Marcar como Ex-Alumno" muestra el mismo texto tenga o no deuda el alumno. Se puede egresar a alguien que debe plata sin enterarse: después aparece en Ex-Alumnos como "Debe $X".

**Decisión del owner (Matías, 2026-10-01):** no se exige saldo 0; si tiene deuda, la confirmación lo advierte con el monto y deja continuar.

## Cambios
- **Archivo:** `src/app/core/utils/egreso-confirmation.utils.ts` — función pura `buildMarcarExAlumnoMessage(nombre, saldoPendiente)`: el texto actual y, si hay saldo, una línea con el monto.
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts` — `onMarcarExAlumno()` usa esa función.

## Verificación
Verificado el 2026-10-01: `egreso-confirmation.utils.spec.ts` (3 casos) en verde y el test E2E `O05` pasa en navegador: con $90.000 de saldo la confirmación dice "Tiene un saldo pendiente de $90.000." y el botón de confirmar sigue habilitado. O01 · O03 · O04 (egreso sin deuda) sigue pasando.

Cierre de la tanda de archivar y egresar (fix-274-m … fix-277-m, hotfix-125-m): `npx vitest run` (2929 tests), `npm run lint:arch` (0 errores) y los dos archivos E2E de Alumnos B (55/55 esperados) en verde; sin datos `E2E-` sobrantes en la BD (0 usuarios, 0 matrículas, 0 clases de prueba).
