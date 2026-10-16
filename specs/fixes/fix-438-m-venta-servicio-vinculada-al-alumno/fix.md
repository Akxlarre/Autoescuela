# Fix: Una venta de servicio a un alumno no queda vinculada a él
> id: fix-438-m-venta-servicio-vinculada-al-alumno
> refs: fix-429-m-testing-servicios-especiales (S8, casos H02, G07–G09) · spec 0025
> status: in_progress
> created: 2026-10-15

## Root Cause

`ServiciosEspecialesFacade.registrarVenta()` inserta siempre `student_id: null`. "Tipo de cliente"
(Cliente externo / Alumno) es solo una marca (`is_student`), aparece solo si el servicio se llama
"psicot…" o "informe", y queda pegada en `true` si se elige "Alumno" y después se cambia de
servicio (G09). Consecuencias: la venta no aparece en la ficha del alumno y la notificación "Pago
registrado" de la spec 0025 nunca se envía (depende de `students.user_id`, que sale de
`student_id`).

**Decisión de Matías (2026-10-15, H02/G09):** si el RUT de la venta es de un alumno, la venta se
vincula a él automáticamente; aparece en su ficha y dispara la notificación. Se elimina el select
"Tipo de cliente".

## ACs Afectados

Ninguno — fix autónomo. ACs propios:

- AC-1: al registrar una venta con el RUT de un alumno (con o sin puntos), se guarda su
  `student_id` e `is_student = true`; con otro RUT, `null` y `false`.
- AC-2: al salir del campo RUT, el drawer avisa "Se vinculará a la ficha de <nombre>" si es alumno.
- AC-3: el alumno recibe la notificación "Pago registrado".
- AC-4: la venta aparece en el historial de pagos de la ficha del alumno como "Servicio especial:
  <servicio>", sin cambiar el total pagado ni el saldo de la matrícula.
- AC-5: no existe el select "Tipo de cliente".

## Cambio

- `core/facades/servicios-especiales.facade.ts` — `buscarAlumnoPorRut()`; `registrarVenta()` vincula
  y notifica.
- `core/models/ui/servicios-especiales.model.ts` — `AlumnoVinculado`; `VentaFormData` sin `esAlumno`.
- `registrar-venta-drawer` — sin "Tipo de cliente"; aviso de vinculación al salir del RUT.
- `core/facades/admin-alumno-detalle.facade.ts` + `core/models/ui/alumno-detalle.model.ts` +
  `admin-historial-pagos` — las ventas del alumno se suman al historial de pagos de la ficha.

## Test de Regresión

- `servicios-especiales.facade.spec.ts > registrarVenta — venta a un alumno por su RUT (fix-438-m)`.
- `admin-alumno-detalle.facade.spec.ts > fix-438-m`.
