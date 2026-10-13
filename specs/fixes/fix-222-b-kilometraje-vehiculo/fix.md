# Fix: El kilometraje del vehículo no se actualiza con vehículos "Ambas", puede retroceder y el mantenimiento no lo mueve
> id: fix-222-b-kilometraje-vehiculo
> refs: ASG-i-032 (checklist 032, sospechas S2, S3 y S6; casos M03, N01–N05; decisiones 2 y 3 del owner, 2026-10-12)
> status: done
> created: 2026-10-13

## Root Cause
[Confirmado leyendo el código y la BD el 2026-10-12 y 13.] El kilometraje del vehículo
(`vehicles.current_km`) lo escribe **la app, directo sobre la tabla**, al finalizar una clase:

- **S2:** con la sesión de la secretaria, la RLS de `vehicles` solo deja editar vehículos de su sede
  que no sean "Ambas". Al finalizar una clase con un vehículo "Ambas" (o de otra sede) el UPDATE no
  afecta filas. Desde fix-362-m la app **avisa** ("no se pudo actualizar el kilometraje"), pero el
  dato se pierde igual.
- **S3:** el UPDATE pone `current_km = km final` sin mirar el valor anterior: un km mal tipeado
  (4.500 en vez de 45.000) deja el odómetro del vehículo 40.000 km atrás.
- **S6:** registrar un mantenimiento solo inserta en `maintenance_records`; no hay nada que lleve su
  kilometraje ni su fecha al vehículo.

## Decisiones
- **Owner (2026-10-12), decisión 2:** el kilometraje no baja en el uso normal; solo el admin lo
  corrige desde Editar, con confirmación (hotfix-075-b).
- **Owner (2026-10-12), decisión 3:** registrar un mantenimiento actualiza el kilometraje y la
  "última mantención", solo si el km informado es mayor al actual.
- **Matías (2026-10-11, fix-375-m):** Iniciar y Finalizar clase **avisan** ante un km sospechoso, no
  bloquean ("el odómetro real manda"). **Se respeta:** los formularios no cambian. La regla "no baja"
  se aplica al kilometraje **registrado del vehículo**, no a lo que se anota en la clase.

## ACs Afectados
- fix-189 ("el km final se propaga al vehículo") y fix-362-m ("si no se pudo guardar el km, se
  avisa"): el km ya no depende de los permisos de quien finaliza, así que ese aviso deja de existir.

ACs propios:
- **F1:** al finalizar una clase, el km del vehículo queda en el km final **quienquiera que la
  finalice** (admin, secretaria o instructor), también con un vehículo "Ambas" o de otra sede.
- **F2:** el km del vehículo nunca baja por una clase: si el km final es menor al registrado, el
  vehículo conserva el suyo (la clase guarda igual lo que se anotó).
- **F3:** registrar o editar un mantenimiento completado con km mayor al del vehículo lo actualiza;
  con km menor o sin km, no lo toca.
- **F4:** un mantenimiento completado deja su fecha como "última mantención" si es posterior a la
  registrada y no es futura.
- **F5:** el admin sigue pudiendo corregir el km desde Editar vehículo (con confirmación si baja).

## Cambio
- `supabase/migrations/20261013120000_fix222_km_vehiculo_por_trigger.sql` — triggers
  `trg_sync_vehicle_km_from_class` (sobre `class_b_sessions`) y `trg_sync_vehicle_from_maintenance`
  (sobre `maintenance_records`), `SECURITY DEFINER`. **Requiere aplicar** (aprobación del owner),
  **antes** de publicar la app.
- `src/app/core/facades/asistencia-clase-b.facade.ts` y `instructor-clases.facade.ts` (+ specs) — ya
  no escriben `vehicles.current_km` al finalizar: lo hace la BD.

## Test de Regresión
- `supabase/tests/flota/fix-222-b-km-vehiculo.sql` — F1–F4, en un bloque que se deshace.
- `npx vitest run src/app/core/facades/asistencia-clase-b.facade.spec.ts src/app/core/facades/instructor-clases.facade.spec.ts`

## Progreso
- [x] Migración + test SQL en transacción con ROLLBACK: 14 casos, 0 fallas (contra producción hoy falla en 10). Incluye el caso S2: la secretaria de la sede 2 no puede editar el vehículo "Ambas", pero al guardar el km final de su clase el vehículo queda actualizado.
- [x] Facades sin el UPDATE directo a `vehicles`; specs reescritos (los de fix-189 y fix-362-m sobre el km pasan a "no escribe en vehicles"): 81/81. `tsc` sin errores, `lint:arch` 0 errores.
- [x] Migración aplicada (aprobada 2026-10-13) y registrada. Test SQL contra producción: 14/14, sin datos de prueba residuales.
