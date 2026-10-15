# Fix: La secretaria puede modificar pagos por consola y se pueden registrar pagos en un día con caja cerrada
> id: fix-051-i-pagos-secretaria-update-y-caja-cerrada
> refs: fix-048-i-testing-pagos-y-descuentos (B1-1, B2-3)
> status: done
> closed: 2026-10-15
> created: 2026-10-15

## Root Cause

Dos huecos de la BD en `payments`, misma migración:

- **B1-1:** la policy `update_payments` (`20261001150000_rls_aislamiento_por_sede.sql`) deja a la
  secretaria hacer UPDATE de cualquier columna de los pagos de su sede. El tope de sobrepago
  (`check_payment_within_pending_balance`) es solo `BEFORE INSERT`, y `guard_anulacion_pago`
  solo controla el paso a `anulado`. Por consola la secretaria puede subir un monto (saldo
  negativo) o pasar un pago a `pending` (lo saca del saldo sin rastro de anulación). Ninguna
  pantalla de la secretaria hace UPDATE de pagos: el único UPDATE de la app es la anulación del
  admin (`cuadratura.facade.ts`); las edge functions usan `service_role` y las RPC son
  `SECURITY DEFINER`.
- **B2-3:** `fix-044-i` bloqueó **borrar** y `0025-m` **anular** movimientos de un día con caja
  cerrada, pero nada impide **insertar** un pago con `payment_date` de ese día. El cierre guarda
  totales congelados (DG-065): ese pago no entra a ningún cierre y la Caja deja de cuadrar con
  Pagos y Reportes. La UI no limita la fecha (G03).

## ACs Afectados

Ninguno de una spec — bugs encontrados en testing (`fix-048-i`). Criterios de este fix:

- **AC-F1:** la secretaria no puede modificar ningún pago (UPDATE → 0 filas); el admin sí
  (la anulación sigue funcionando).
- **AC-F2:** un pago con `payment_date` de un día con caja cerrada de su sede se rechaza con un
  mensaje claro, para admin y secretaria, también por las RPC del wizard de matrícula.
  Decisión de negocio (Ignacio, 2026-10-15): **también la caja de hoy**, si ya se cerró.
- **AC-F3:** un pago sin fecha (`pending`) o de un día sin cierre se registra igual que antes.
- **AC-F4:** los pagos que entran sin sesión de usuario (edge functions de pago online con
  `service_role`) no se bloquean: rechazarlos perdería un cobro ya hecho.

## Cambio

- **Archivo:** `supabase/migrations/20261015120000_fix051i_pagos_update_admin_y_caja_cerrada.sql`
- **Qué cambia:** `update_payments` pasa a solo admin; nuevo trigger `BEFORE INSERT`
  `trg_payments_insert_caja_cerrada` (función `guard_pago_en_caja_cerrada()`), mismo criterio de
  sede que `guard_movimiento_caja_cerrada`. El mensaje va en español con `P0001`, que
  `ErrorSanitizerService` muestra tal cual.
- **Archivo:** `src/app/features/admin/pagos/registrar-pago-drawer.component.ts`
- **Qué cambia:** el `catch` de `onSubmit()` pasa siempre el error por `ErrorSanitizerService`.
  Encontrado en la QA: solo sanitizaba `instanceof Error`, y supabase-js entrega un objeto plano,
  así que el aviso de caja cerrada salía como "Error al guardar. Intenta de nuevo." (AC-F2).

## Test de Regresión

- `supabase/tests/rls/fix-051-i-pagos-update-y-caja-cerrada.sql` (secretaria UPDATE → 0 filas;
  admin UPDATE → ok; INSERT en día cerrado → rechazo para secretaria y admin; INSERT `pending`
  y en día abierto → ok; sin sesión → ok).
- QA Playwright: "Registrar Pago" como secretaria con fecha de un día cerrado → mensaje claro y
  no se guarda.

## Progreso

- [x] Migración aplicada en Supabase (2026-10-15).
- [x] Test SQL 8/8 ✅ (2026-10-15).
- [x] QA Playwright como secretaria (matrícula 6363, fecha 27-08-2026): se ve "La caja del 27-08-2026 ya está cerrada…", el drawer queda abierto y no se guarda nada. Antes del arreglo del drawer salía "Error al guardar. Intenta de nuevo."
- [x] `registrar-pago-drawer.component.spec.ts` 11/11, suite completa 4183, `lint:arch` 0 errores.
