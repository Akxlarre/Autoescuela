# Fix: Estados de pago en inglés sin traducir en Pagos Recientes
> id: fix-134-m-estados-pago-sin-traducir
> refs: fix-132-m-app-like-familia-pagos
> status: done
> closed: 2026-08-06
> created: 2026-08-06

## Root Cause
`mapEstado()` en `pagos.facade.ts` solo traduce `'paid'` → `completado` y `'partial'` →
`pendiente`. El valor real `'pending'` (usado por la columna `payments.status`, ver comentario
en `20260301000005_05_payments_and_finances.sql:48` — `'paid' | 'pending' | 'partial'`, y por
`rpc_confirm_enrollment_with_payment.sql:94`) no está cubierto por el `switch` y cae al
`default: return status`, devolviendo el string crudo de la BD (`'pending'`, o cualquier otro
valor no anticipado) sin traducir.

Como agravante, `estadoLabel()` y `estadoVariant()` en `pagos-recientes-drawer.component.ts`
tienen el mismo problema en cascada: su `default` también devuelve/trata el valor crudo en vez
de un fallback neutro, así que un estado no mapeado llega crudo hasta el badge en pantalla
(captura del usuario: badges `confirmed` y `pending` sin traducir, mientras `completado` sí se
ve como "✓Completado").

## ACs Afectados
Ninguno — fix autónomo (bug visual descubierto en QA manual del panel "Pagos recientes").
- AC-1: Todo badge de estado en "Pagos recientes" muestra texto en español, nunca el valor crudo de `payments.status`.

## Cambio
- **Archivo:** `src/app/core/facades/pagos.facade.ts`
- **Qué cambia:** `mapEstado()` cubre explícitamente `'pending'` → `pendiente`, y cualquier
  status no reconocido cae a `pendiente` (fallback seguro) en vez de devolver el string crudo.
- **Archivo:** `src/app/features/admin/pagos/pagos-recientes-drawer.component.ts`
- **Qué cambia:** `estadoLabel()`/`estadoVariant()` defensivos ante cualquier valor no mapeado
  (no reflejan el string crudo).

## Test de Regresión
- `src/app/core/facades/pagos.facade.spec.ts` > `mapEstado traduce 'pending' a 'pendiente'` ✓
