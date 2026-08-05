# Asignación ASG-b-063 — Race condition "lost update" en `pending_balance` al registrar pagos

> **status:** reclamada
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** m
> **claimed_at:** 2026-08-05
> **resulting_track:** fix-114-m-race-condition-pending-balance-pagos

---

## Contexto / Objetivo

`PagosFacade.registrarNuevoPago()` (`src/app/core/facades/pagos.facade.ts:357-393`) calcula
`pending_balance` y `total_paid` a partir de `montosActuales`, un snapshot pasado por
**parámetro** desde el componente caller — no lo relee de BD antes de escribir. Si el mismo
abono se dispara dos veces con ese snapshot desactualizado (doble submit por latencia, dos
pestañas del mismo usuario, o un replay del request), la segunda escritura pisa el saldo que
ya había calculado la primera: ambos pagos quedan insertados en `payments` (correcto), pero
`enrollments.pending_balance` solo refleja uno de los dos — el alumno queda con saldo
pendiente incorrecto, sin error visible en ningún lado.

Mismo patrón de fondo en `EnrollmentFacade.confirmWithPayment()`
(`src/app/core/facades/enrollment.facade.ts:1327+`) y `confirmEnrollment()` (línea 1259): el
flag `_isSubmitting` se setea al entrar, pero el método nunca chequea `_isSubmitting()` al
principio para rechazar una re-entrada — la única defensa real hoy es el `isSaving` local del
componente (`[disabled]="isSaving()"` en el botón), que no protege contra dos pestañas ni
contra un caller que no la respete.

Auditoría completa (incluye el segundo hallazgo relacionado, `ASG-b-064`) hecha a pedido del
cliente evaluando "qué pasa si un usuario usa la app de la peor forma posible" — sesión
2026-08-02/03.

## Alcance sugerido

- Mover el cálculo de `pending_balance`/`total_paid` a un RPC de Postgres atómico
  (`pending_balance = pending_balance - amount`, resuelto en el motor, no leído-calculado-
  escrito desde el cliente). Ya existe el mismo patrón resuelto para
  `get_next_enrollment_number` (`enrollment.facade.ts:2111`, vía `supabase.rpc(...)`) — replicar
  ese enfoque, no inventar uno nuevo.
- Revisar si `confirmEnrollment()`/`confirmWithPayment()` necesitan además un guard explícito
  de re-entrada (`if (this._isSubmitting()) return null;` al inicio del método) para no confiar
  solo en el guard de UI.
- No hace falta tocar el guard de UI (`isSaving` en los componentes) — sigue siendo válido como
  primera línea de defensa, esto es sobre la segunda línea (el dominio) que hoy no existe.

## Referencias

- Ninguna spec previa. Relacionado por síntoma con `ASG-b-013` (fix-h024-registrar-pago-
  silencioso) — no es el mismo bug pero toca el mismo método, coordinar si siguen abiertos a
  la vez.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/pagos.facade.ts` (método `registrarNuevoPago`, línea ~357)
- `src/app/core/facades/enrollment.facade.ts` (métodos `confirmEnrollment` línea ~1259 y
  `confirmWithPayment` línea ~1327)
- Nueva migración SQL en `supabase/migrations/` para el RPC atómico

## Notas para quien la reclame

- Prioridad P1: es un bug de dinero (saldo de alumno incorrecto), pero requiere doble-submit
  o dos pestañas para gatillarse — no es explotable con un solo click normal.
- Al escribir el RPC, verificar que sea `SECURITY DEFINER` si RLS bloquea el `UPDATE` directo
  a `enrollments` desde el rol del caller (ver convención de otras funciones RPC del proyecto).
- Antes de cerrar, agregar un test que dispare `registrarNuevoPago` dos veces "concurrentemente"
  (dos promesas sin await intermedio) contra el mismo enrollment y verifique que el balance
  final sea la resta de AMBOS pagos, no solo uno.
