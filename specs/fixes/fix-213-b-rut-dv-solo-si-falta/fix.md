# Fix: El DV del RUT se "corrige" solo y se come un dígito si no lo escribiste
> id: fix-213-b-rut-dv-solo-si-falta
> refs: ASG-i-034 (caso C05, hallado en fix-197-b) · ASG-b-047 (requerimiento original) — decisión del owner 2026-10-07: completar el DV solo si falta; si está mal, error
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado con e2e el 2026-10-07.] ASG-b-047 (reunión con el cliente) pidió: *"se llena todo,
excepto el dígito verificador del rut que se debe poner auto"*. `autocompleteRutDv()` (fix-064-b)
lo implementó como "el último carácter siempre es el DV y se recalcula", y `formatRut()` mete el
guion antes del último dígito mientras se escribe. Resultado:
1. Escribir solo el número (`11111111`, lo que pidió el cliente) deja `1.111.111-4`: el último
   dígito del cuerpo se toma como DV y se reemplaza. Se pierde un dígito.
2. Un RUT con un dígito mal tecleado "pasa": el DV se recalcula para ese RUT equivocado, así que la
   validación módulo 11 nunca detecta el error.
3. En Matrícula e inscripción pública el teclado no deja escribir el guion.

## ACs Afectados
Ninguno de una spec previa. ACs propios:
- **F1:** mientras se escribe, sin guion solo se ponen puntos al número; el guion aparece solo si el
  usuario lo escribe (o escribe una K, que solo puede ser DV).
- **F2:** al salir del campo, **sin guion** el número se toma entero como cuerpo y se le agrega el DV
  calculado (`11111111` → `11.111.111-1`); con 9+ dígitos el último es el DV.
- **F3:** **con guion** (o K) se respeta lo escrito: nunca se reemplaza un DV; si está mal, el
  formulario muestra su error de RUT inválido.
- **F4:** se puede teclear el guion en todos los formularios con RUT.
- **F5:** `formatRut()` (normalización para guardar) no cambia.

## Cambio
- `src/app/core/utils/rut.utils.ts` (+ spec) — `formatRutTyping()` y `completeRutDv()`; se elimina
  `autocompleteRutDv()`.
- Los 7 formularios con RUT: crear instructor, crear secretaria, crear relator, inscribir en curso
  singular, registrar venta de servicio especial, Matrícula (datos personales) e inscripción pública.

## Test de Regresión
- `npx vitest run src/app/core/utils/rut.utils.spec.ts`
- `npx playwright test e2e/rut-dv.spec.ts --workers=1` (build de prod en :4200)

## Progreso
- [x] `rut.utils.spec.ts` 17/17 (rojo → verde): `formatRutTyping` y `completeRutDv` (cuerpo solo, 9 dígitos, con guion nunca se reemplaza, idempotente); `formatRut` sin cambios.
- [x] Los 7 formularios usan las funciones nuevas; Matrícula e inscripción pública ya dejan teclear el guion. `test:ci` 256 archivos ✓, `ng build` ✓, `lint:arch` 0 errores (182).
- [x] En vivo (Crear instructor y Crear secretaria, sin enviar): `11111111` → `11.111.111` mientras se escribe y `11.111.111-1` al salir; `12345678-1` queda tal cual y marca error; `12345678-5` queda igual. 2/2. La inscripción pública está bloqueada por el piloto y la Matrícula exige pasos previos: las cubre la misma función y sus tests.
- [x] `indices:sync` (UTILS.md sin `autocompleteRutDv`).
