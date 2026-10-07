# Fix: El número de licencia del instructor no se pide al crear ni se valida al editar
> id: fix-211-b-numero-licencia-obligatorio
> refs: ASG-i-034 (sospecha S20, confirmada en fix-197-b) — decisión del owner 2026-10-07: obligatorio en ambos; licencia vencida se sigue pudiendo guardar al editar
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado leyendo el código el 2026-10-07.]
- Crear instructor no tiene campo de número de licencia: manda `licenseNumber: ''` y se guarda NULL.
  Los documentos del instructor (DMS) lo muestran, así que un instructor nuevo queda sin número.
- Editar lo marca "Número de licencia *" pero no lo valida: se puede borrar y guardar vacío.

Las 16 filas actuales de `instructors` tienen número: hacerlo obligatorio no bloquea a nadie.

**Se mantiene (decisión del owner):** Editar permite guardar con la licencia vencida. Si se
bloqueara, no se podría ni desactivar a un instructor con la licencia vencida sin inventar una fecha;
la ficha ya la marca "Vencida" y la Agenda avisa (fix-202-b).

## ACs Afectados
Ninguno de una spec previa. ACs propios:
- **F1:** Crear pide "Número de licencia *"; sin número válido no se puede crear, y lo que se escribe se envía.
- **F2:** Editar exige número válido; vacío muestra el error y no guarda.
- **F3:** válido = al menos 3 caracteres sin contar espacios a los lados.
- **F4:** Editar sigue guardando con la licencia vencida.

## Cambio
- `src/app/core/utils/license-number.utils.ts` (+ spec) — `isValidLicenseNumber()`.
- `src/app/features/admin/instructores/admin-instructor-crear-drawer.component.ts` — campo nuevo.
- `src/app/features/admin/instructores/admin-instructor-editar-drawer.component.ts` — validación.

## Test de Regresión
- `npx vitest run src/app/core/utils/license-number.utils.spec.ts`
- `npx playwright test e2e/instructores-licencia.spec.ts e2e/instructores-alta.spec.ts --workers=1`

## Progreso
- [x] `license-number.utils.spec.ts` 2/2 (rojo → verde). Crear: campo "Número de licencia *" + validación + se envía; Editar: validación + error. La regla de licencia vencida en Editar no se tocó (F4).
- [x] `ng build` ✓, `lint:arch` 0 errores (182, sin nuevas). e2e contra el build de prod, sin guardar: D01 ahora llena el número y la función recibe `licenseNumber: '11111111'` (antes siempre `''`); Editar con el número vacío muestra el error y no llama a `update-instructor`. 3/3.
- Nota: la regla vive en el front. `create-instructor`/`update-instructor` siguen aceptando el número vacío si alguien las llama directo; endurecerlas requiere redeploy.
