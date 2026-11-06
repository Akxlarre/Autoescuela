# Fix: la matrícula online Clase B no valida en el servidor la sede ni los horarios elegidos
> id: fix-240-b-matricula-online-valida-sede-y-horarios
> refs: ASG-i-026 (fix-186-b; hallado al implementar spec 0057-b)
> status: done
> closed: 2026-11-06
> created: 2026-11-06

## Root Cause
`public-enrollment` confía en lo que manda el navegador al crear la matrícula Clase B. En
`submit-clase-b` y en `initiate-payment` (que deja el snapshot que usa `confirm-payment`):

- no comprueba que el instructor atienda la sede de la matrícula;
- no comprueba que cada horario elegido exista en `v_class_b_schedule_availability` para ese
  instructor, esté `available`, sea de esa sede (`branch_ids`, spec 0057-b), sea de un día
  posterior a hoy (como la grilla) ni que no lo tenga retenido otra sesión (`slot_holds`);
- toma el vehículo de cualquier asignación activa del instructor, no el del horario.

La grilla del alumno sí filtra todo eso, pero solo en el cliente: quien llame a la función a mano
(o un navegador con datos viejos) crea clases en horarios ocupados, de otra sede o con otro
vehículo.

## ACs Afectados
Ninguno de una spec — hallazgo de seguridad e integridad de datos:
- **V1:** una selección con un horario que no es de la sede, no está libre, es de hoy o antes, no
  existe para el instructor, está repetida o la retiene otra sesión se rechaza **antes** de crear
  usuario, alumno, matrícula, intento de pago o transacción Webpay.
- **V2:** el rechazo responde `{ success: false, error: 'SLOTS_UNAVAILABLE', message }`; la página
  ya muestra `message` sin cambios.
- **V3:** las clases se crean con el vehículo del horario y el `slot_start` de la vista.

## Cambio
- **Archivo:** `supabase/functions/_shared/clase-b-selection.ts` (nuevo) — función pura
  `checkClaseBSelection()`.
- **Archivo:** `supabase/functions/public-enrollment/index.ts` — `validateClaseBSelection()` lee la
  vista y los holds y la llama en `submit-clase-b` y `initiate-payment` antes de escribir nada.

- `confirm-payment` (retorno de Webpay) no re-valida: el pago ya se hizo y los horarios siguen
  retenidos en `slot_holds` mientras el alumno paga.

## Test de Regresión
- `supabase/functions/_shared/clase-b-selection.test.ts` (Deno) ✓ 11 tests: acepta libres de la
  sede normalizando el formato del instante; rechaza inexistente, ocupado, de otra sede, de hoy en
  Chile (aunque en UTC sea mañana), retenido por otra sesión, repetido, id que no es fecha, vacío,
  más de 20 y repartido en dos vehículos; con dos filas por horario basta una válida. Corrido el
  2026-11-06 con Vitest y un shim de `Deno.test`/`assertEquals` (no hay `deno` en el equipo).
- `npm run lint:arch`: 0 errores.
- Desplegado a producción el 2026-11-06. La inscripción online sigue cerrada en producción
  (`PUBLIC_ENROLLMENT_ENABLED`, fix-193-b): la función arranca con el módulo nuevo y responde 503
  a toda acción, así que el rechazo `SLOTS_UNAVAILABLE` no se pudo ver allí. Verificado por SQL
  tras 3 llamadas inválidas: 0 intentos de pago, 0 usuarios y 0 matrículas creadas. Al abrir la
  inscripción, repetir esas 3 llamadas (otra sede, ocupado, horario inventado) antes de anunciarla.
