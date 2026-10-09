# Fix: escrituras a Supabase que no revisan el error y muestran éxito igual
> id: fix-362-m-escrituras-sin-revisar-error-muestran-exito
> refs: ASG-i-055
> status: done
> closed: 2026-10-08
> created: 2026-10-08

## Root Cause
[Heredado de ASG-i-055, confirmado leyendo el código el 2026-10-08 — no forzado en el
navegador]: supabase-js no lanza excepción cuando una escritura falla:
devuelve `{ error }`. En ~13 grupos de llamadas ese `error` no se revisa y la UI muestra un toast
de éxito aunque la RLS o la red lo hayan rechazado. Ejemplos: KM del vehículo al cerrar una clase
con un vehículo de otra sede (`asistencia-clase-b.facade.ts:449-455`), cancelar un comunicado que
no se canceló (`announcements.facade.ts:479-491`).

Inventario: `specs/testing-piloto/037-transversal-multisede-shell.md` §1.7. Los números de línea
son del 2026-09-29 y hay ~100 fixes posteriores: se re-verifica cada ocurrencia contra el código
actual antes de tocarla.

Encontrado al confirmar:
- El código actual tenía 39 escrituras con el resultado descartado en 9 Facades (más las 7 de
  Cuadratura). `announcements.facade.ts` y `notification-templates.facade.ts` ya revisaban el
  error (el primero se reescribió en fix-361-m).
- Revisar `error` no alcanza para el ejemplo de la ASG: un UPDATE/DELETE que la RLS filtra
  responde sin error y con cero filas. El KM de un vehículo de otra sede caía en ese caso.

Fuera de alcance:
- Cuadratura (`cuadratura.facade.ts`) → `ASG-i-048`, sigue pendiente.
- Las lecturas `const { data } = await …` sin `error` (un fallo se ve como lista vacía): el
  inventario las da por reportadas módulo por módulo.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- `core/utils/db-error.utils.ts`: `assertWriteOk(result, { requireRows? })` lanza el `error` de
  la respuesta; con `requireRows` (y `.select()` en la query) lanza `NoRowsAffectedError` si no
  se tocó ninguna fila. `toFriendlyDbMessage` traduce ese error.
- Criterio por sitio: si la escritura es **previa o parte de la acción principal**, se corta
  (lanza o `_error` + `return false`); si es **secundaria y la principal ya quedó hecha**, no se
  lanza — se avisa con toast de advertencia qué quedó sin guardar (lanzar haría que el usuario
  reintente algo que sí ocurrió).
- `asistencia-clase-b.facade.ts`: `markAttendance` y `justifyAbsence` cortan (incluye 0 filas y
  matrícula no encontrada) y muestran el motivo; `finishClass` avisa si no se guardó el KM
  (error **o** 0 filas) o la asistencia; la RPC de penalización avisa si falla.
- `instructor-clases.facade.ts`: `finishClass`, igual que el de secretaría.
- `liquidaciones.facade.ts`: pagar y revertir cortan si no cambia el estado de los anticipos.
- `tasks.facade.ts`: `markSeen` avisa (antes fallaba en silencio); `addReply` avisa si la
  consulta no pasó a "en curso".
- `promociones.facade.ts`: el aviso de "feriados marcados" solo sale si se marcaron.
- `asistencia-profesional.facade.ts`: avisa si la sesión no quedó como realizada, o si al
  cancelarla no se borró su asistencia.
- `enrollment-payment.facade.ts`: si no se puede borrar el pago/descuento anterior, corta antes
  de insertar otro (evita el duplicado).
- `enrollment.facade.ts`: cortan quitar la convalidación, liberar reservas anteriores, guardar
  la modalidad de pago y cada borrado de `discardDraft`; avisan confirmar las sesiones
  reservadas (la matrícula ya está activa) y extender la vigencia del borrador. La limpieza de
  `students`/`users` huérfanos deja `console.error` (el borrador ya se descartó).
- `admin-pre-inscritos.facade.ts`: activar el usuario corta; documentos, contrato y
  `docs_complete` avisan lo que no se guardó; `uploadSignedContract` ya no devuelve `true` si el
  contrato no se subió.
- **Para que no se repita:** `core/facades/unchecked-writes.guard.spec.ts` recorre los Facades
  y falla si una escritura descarta su resultado. Se eligió un test y no una regla de
  `lint:arch` porque `scripts/architect.js` está protegido; corre en `npm run test:ci`.
  `cuadratura.facade.ts` está en su lista de pendientes, atado a `ASG-i-048`.
- Índices: `DOMAIN-GOTCHAS.md` (DG-103), `UTILS.md`, `SERVICES.md`.

## Test de Regresión
- `core/utils/db-error.utils.spec.ts`: `assertWriteOk` (5) + traducción de `NoRowsAffectedError`.
- `core/facades/unchecked-writes.guard.spec.ts`: detector (6 casos) + los 61 Facades.
- `asistencia-clase-b.facade.spec.ts` (8 nuevos): upsert rechazado, sesión filtrada por RLS,
  RPC de penalización, justificación sin filas, y `finishClass` con vehículo de otra sede.
- `liquidaciones.facade.spec.ts`, `tasks.facade.spec.ts` (4), `enrollment-payment.facade.spec.ts`.
- `instructor-clases.facade.spec.ts` (KM filtrado por RLS), `promociones.facade.spec.ts`
  (`cancelHolidaySessions`), `asistencia-profesional.facade.spec.ts` (cancelar sesión),
  `enrollment.facade.spec.ts` (`discardDraft`) y `admin-pre-inscritos.facade.spec.ts`
  (`uploadSignedContract`). Sin test dedicado: las ramas de aviso de `completarMatricula`,
  `guardarAsistencia`, `confirmEnrollment` y `resumeDraft`.
- `npm run test:ci`: 3628 pasan, 5 omitidos. `npm run lint:arch`: sin errores.
- **Navegador real** (`e2e/escrituras-fallidas.spec.ts`, la escritura se intercepta y nada llega
  a la base): al pagar y al revertir una liquidación con el update de anticipos rechazado sale
  el aviso de error y no el de éxito. Comprobado contra el código sin el arreglo: ahí los dos
  tests fallan (sale el éxito), lo que confirma en vivo la sospecha de la ASG. En desarrollo
  `instructor_monthly_payments` está vacía, así que para revertir la lectura de esa tabla
  también se simula (todo instructor figura pagado).
- No probado en navegador: finalizar una clase con un vehículo de otra sede (necesita una clase
  en curso); queda cubierto por los tests unitarios.
