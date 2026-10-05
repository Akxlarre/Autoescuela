# Fix: La ficha muestra el concepto real de cada pago
> id: fix-315-m-la-ficha-muestra-el-concepto-real-de-cada-pago
> refs: ASG-i-024
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Root Cause
El "Estado Financiero" de la ficha traduce `payments.type` con una tabla fija de códigos internos
en inglés (`enrollment`, `online`, `partial`…) y, si el valor no está en la tabla, escribe
"Pago #N". Pero el formulario "Registrar pago" guarda el concepto ya en español, tal como lo elige
el usuario: "Matrícula", "Abono", "Segunda Cuota (Clases 7-12)", "Pago Total" u "Otro". Ninguno de
esos está en la tabla, así que todo pago registrado desde ese formulario aparece en la ficha como
"Pago #1", "Pago #2"… Solo se ven bien los pagos creados por el wizard (`enrollment`) y por Webpay
(`online`). Anotado como observación en `024b` I01 · I02 de `fix-264-m`.

## ACs Afectados
- `024b` I01: cada pago de la ficha muestra su concepto. Un código interno conocido se traduce; un
  concepto ya escrito en español se muestra tal cual; "Pago #N" queda solo para pagos sin concepto.

## Cambio
- **Archivo:** `src/app/core/utils/ficha-pagos.utils.ts` — `formatPaymentConcept()`: la traducción,
  como función pura.
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts` — usa esa función en los dos
  lugares donde arma el historial (Clase B y Profesional) y pierde su copia privada.

## Test de Regresión
- `ficha-pagos.utils.spec.ts > formatPaymentConcept (fix-315-m)` (12 tests) ✓

## Verificación
2026-10-05: 104 tests en verde entre el util y el facade de la ficha; sin errores de compilación. No se comprobó en navegador con un pago real registrado como "Abono": habría que registrar un pago, que queda en la caja de desarrollo.
