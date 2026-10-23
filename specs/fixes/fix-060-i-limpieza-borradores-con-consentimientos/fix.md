# Fix: La limpieza nocturna de borradores se cae entera si un borrador vencido tiene consentimientos
> id: fix-060-i-limpieza-borradores-con-consentimientos
> refs: fix-058-i-testing-matricula-presencial (B1-2)
> status: done
> closed: 2026-10-22
> created: 2026-10-22

## Root Cause

`cleanup_expired_drafts()` (cron diario 3 AM UTC) borra los borradores vencidos con un `DELETE`
de `enrollments`, pero `consents.enrollment_id` apunta a `enrollments` sin `ON DELETE`. La tabla
`consents` es append-only (Ley 21.719, spec 0009-m): no se puede borrar ni desvincular un
consentimiento, ni siquiera desde la limpieza. Si un solo borrador vencido tiene un consentimiento,
el `DELETE` choca con `consents_enrollment_id_fkey`, la función no tiene bloque `EXCEPTION` y la
corrida completa aborta: **ningún** borrador vencido se limpia y sus clases siguen ocupando la
agenda.

Latente: al 2026-10-18 había 0 borradores con consentimientos. Se da si `confirmEnrollment()`
registra el consentimiento (va antes de activar desde el arreglo de S2) y la activación falla, y el
borrador después vence.

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-058-i` B1-2). Criterios de este fix:

- **AC-F1:** un borrador vencido **con** consentimientos no se borra: queda `cancelled`, sus clases
  prácticas se borran (libera la agenda) y sus consentimientos quedan intactos y vinculados.
- **AC-F2:** los borradores vencidos **sin** consentimientos se siguen borrando como antes, aunque
  en la misma corrida haya uno con consentimientos.
- **AC-F3:** los pagos del borrador cancelado no se tocan (qué hacer con un pago cobrado de un
  borrador vencido es B1-1, decisión de negocio pendiente).
- **AC-F4:** una matrícula `cancelled` con saldo no aparece en la lista de deudores ni en el total
  de pagos pendientes de Pagos (hoy solo se excluía `draft`; ya pasaba con las matrículas online
  que vencen sin pago).

## Cambio

- **Archivo:** `supabase/migrations/20261022130000_fix060i_cleanup_drafts_con_consentimientos.sql`
- **Qué cambia:** `cleanup_expired_drafts()` separa los borradores vencidos que tienen
  consentimientos: los pasa a `cancelled` y les borra las clases prácticas (y su asistencia /
  referencias en incidentes de ruta). El resto sigue el camino de siempre.
- **Archivo:** `src/app/core/facades/pagos.facade.ts`
- **Qué cambia:** `fetchPagosPendientes()` y `fetchAlumnosConDeuda()` excluyen `cancelled` además
  de `draft`.

## Test de Regresión

- `supabase/tests/rls/fix-060-i-cleanup-borradores-consentimientos.sql` (ZZ001, no deja datos).
- `src/app/core/facades/pagos.facade.spec.ts` (las queries de deuda excluyen `cancelled`).

## Progreso

- [x] Pagos excluye `cancelled` (AC-F4): `pagos.facade.spec.ts` 22/22 (2026-10-22).
- [x] Migración y test SQL guardados en el repo (2026-10-22).
- [x] Primera corrida (2026-10-22, con la primera versión ya aplicada): 1–5 fallan con
      `chk_expires_at_draft_only` — al cancelar quedaba `expires_at` puesto. Corregido en la
      migración (`expires_at = NULL`) y fila 6 nueva en el test. La corrida "antes del arreglo" no
      se hizo; el fallo por `consents_enrollment_id_fkey` ya quedó demostrado en fix-058-i Bloque 1.
- [x] Migración corregida aplicada en Supabase y test SQL en verde (AC-F1..F3).
- [x] Suite completa, `tsc`, `lint:arch` y cierre.

## Verificación

- 2026-10-22, test SQL en Supabase con la migración corregida: cancelada ✅, 12 de 12 clases
  borradas ✅, consentimientos vinculados ✅, 1 de 1 pago intacto ✅, borrador sin consentimiento
  borrado en la misma corrida ✅, sin `expires_at` ✅, no deja datos ✅. Hoy: 0 borradores con
  consentimientos.
- La fila 3 esperaba "1" y salió "4": la matrícula elegida (N° 0084 de QA-058) ya tenía 3
  consentimientos reales. Se ajustó el esperado a "los que tenía + el de prueba"; la limpieza
  estaba bien.
- `pagos.facade.spec.ts` 22/22 (caso nuevo: las dos consultas de deuda excluyen `draft` y
  `cancelled`), suite completa 298 archivos, `tsc` limpio, `lint:arch` 0 errores. Sin cambios
  visuales.
- Gotcha registrado: DG-118 (`indices/DOMAIN-GOTCHAS.md`).
