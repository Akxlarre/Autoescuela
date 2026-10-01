# Asignación ASG-i-048 — Cuadratura: operaciones que fallan en silencio y corrompen saldos

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

**Sospecha no confirmada en vivo** (tanda de testing 2026-09-29). En `cuadratura.facade.ts`
varias escrituras no revisan el `error` de Supabase (supabase-js no lanza excepción) y muestran
toast de éxito igual:

1. **Eliminar un ingreso (secretaria)**: primero resta de `enrollments.total_paid` y suma a
   `pending_balance` (la secretaria sí puede hacer UPDATE en `enrollments`) y después borra el
   pago, pero la RLS solo deja borrar pagos al admin → **el pago queda y el saldo del alumno
   queda inflado** (`cuadratura.facade.ts:536-555`; `20260303120000…:61-64`).
2. **Eliminar un anticipo (secretaria)**: la RLS no lo permite y aun así avisa "Egreso eliminado
   correctamente" (`cuadratura.facade.ts:564-578`; `20260301000011…:773-774`).
3. **`cerrarCaja()`**: el `upsert` no revisa `error`; si falla, igual limpia el arqueo y avisa
   "Caja cerrada correctamente" (`cuadratura.facade.ts:777-817`).
4. **Caja cerrada sobrescribible**: el admin tiene UPDATE sin restricción sobre `cash_closings`;
   un segundo cierre o el autoguardado de una pestaña vieja pisa el cierre
   (`20260827140000…:15-24`).

## Alcance sugerido

- **Paso 1, confirmar** con datos de prueba (§4 de `028` y `029`). Para (1): registrar un pago
  de prueba, eliminarlo como secretaria y revisar el saldo; revertir después.
- Revisar `error` en todas las escrituras del facade y mostrar el error real.
- (1): no tocar saldos desde el cliente: borrar el pago y dejar que un trigger recalcule, o usar
  una RPC transaccional; decidir si la secretaria puede eliminar ingresos (UI vs RLS coherentes).
- (4): impedir UPDATE sobre cierres `closed` salvo una acción explícita de reapertura auditada.

## Referencias

- `specs/testing-piloto/028-pagos-descuentos.md` S3 · `029-contabilidad.md` S1-S4

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/cuadratura.facade.ts`
- Migración para `cash_closings` (y trigger de saldo si se elige esa vía)

## Notas para quien la reclame

- Coordinar con `ASG-i-049` (trigger de saldo) si se toca el cálculo de `pending_balance`.
