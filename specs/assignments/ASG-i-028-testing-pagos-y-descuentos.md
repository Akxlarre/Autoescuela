# Asignación ASG-i-028 — Testing: Pagos, abonos y descuentos

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Checklist detallado:** `specs/testing-piloto/028-pagos-descuentos.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

Todo lo relacionado con dinero es P0: un saldo mal calculado o un pago duplicado es un problema
real con el cliente y con el alumno. Pagos se conecta con matrícula (primer pago), ficha
(saldo), cuadratura (caja del día), reportes, dashboard y notificaciones financieras.

**Clasificación:** **Integración/E2E** · dificultad **Alta** · rutas: `/app/{admin,secretaria}/pagos`
+ drawer "Registrar pago" desde la ficha.

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de `fix-058-b` (pago con múltiples matrículas), `fix-197-m` (descuentos predefinidos),
  trigger `trg_check_payment_within_pending_balance` (fix-h024), `ASG-m-003` (número de boleta),
  `ASG-m-005` (filtros de la tabla de pagos), spec `0025-b` (notificaciones financieras).

**2. E2E manual**
- Registrar abono → saldo de ficha, listado de pagos y cuadratura del día se actualizan.
- Pago que excede el saldo → rechazado; pago exacto → saldo 0.
- Doble pago rápido / 2 pestañas o 2 usuarios simultáneos → no hay sobrepago (`ASG-b-063`).
- Alumno con 2 matrículas → el pago se imputa a la matrícula correcta.
- Cada medio de pago (efectivo, transferencia, tarjeta) → impacto correcto en la caja (solo el
  efectivo afecta el arqueo físico).
- Descuentos % y fijo; número de boleta; filtros y exportación del listado.
- Formato financiero ($, separador de miles) consistente en todas las vistas.

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- Abono → assert del saldo en la ficha.
- Sobrepago rechazado; concurrencia con 2 contextos.

## Fuera de alcance

- Webpay / pago online del alumno (fuera del piloto).

## Referencias

- `docs/UAT-PLAN.md` Paquete 4 · `supabase/migrations/20260723010000_fix_h024_*`

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing).

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación. **Cada bug
  encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
- Coordinar con `ASG-i-029`: cada pago probado acá debe verificarse en la cuadratura del día.
