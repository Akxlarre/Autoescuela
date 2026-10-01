# Asignación ASG-i-049 — Pagos duplicados (doble Enter) y sobrepago con pagos simultáneos

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

**Sospecha no confirmada en vivo** (tanda de testing 2026-09-29).

1. **Doble Enter**: el drawer de registrar pago tiene `(ngSubmit)="onSubmit()"` y `onSubmit()` no
   revisa `isSaving()` al entrar; el botón se deshabilita, pero dos Enter rápidos en un campo
   pueden insertar dos veces el mismo abono (`registrar-pago-drawer.component.ts:124,702-716`).
2. **Concurrencia**: el trigger anti-sobrepago (`trg_check_payment_within_pending_balance`) lee
   `pending_balance` con un `SELECT` simple, sin `FOR UPDATE`. Dos pagos simultáneos que caben
   individualmente en el saldo pueden pasar ambos y dejarlo negativo
   (`20260723010000_fix_h024…sql`).

## Alcance sugerido

- **Paso 1, confirmar** (1) con un pago de prueba y Enter rápido (luego eliminar el duplicado
  como admin); (2) se confirma leyendo el trigger en la BD remota — la prueba real de
  concurrencia es difícil de reproducir a mano.
- (1): guard `if (this.isSaving()) return;` al inicio de `onSubmit()` (y revisar otros drawers
  con el mismo patrón).
- (2): `SELECT … FOR UPDATE` sobre la matrícula dentro del trigger. Requiere migración.
- Test de regresión para (1).

## Referencias

- `specs/testing-piloto/028-pagos-descuentos.md` S1, S2
- `docs/UAT-PLAN.md` Paquete 4 (caso de doble pago, verificado 2026-08-24 solo en secuencia)

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/.../registrar-pago-drawer.component.ts`
- Migración del trigger de `payments`

## Notas para quien la reclame

- Relacionado con `ASG-b-063` (race condition del saldo) si sigue abierta: revisar solape.
