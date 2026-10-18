# Fix: Testing — Matrícula presencial (Clase B, refuerzo y Clase Profesional)
> id: fix-058-i-testing-matricula-presencial
> refs: ASG-i-023
> status: in_progress
> created: 2026-10-18

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> **Checklist que se ejecuta:** `specs/testing-piloto/023-matricula-presencial.md`.

## Root Cause

[Heredado de ASG-i-023, a confirmar]: La matrícula presencial es el flujo de entrada de dinero y
alumnos del piloto, y el que más módulos toca a la vez: crea alumno + matrícula, agenda clases
(Triple Match), genera contrato, registra el primer pago, sube documentos al DMS, crea la cuenta
del alumno y dispara notificaciones. Un error acá se propaga a agenda, pagos, cuadratura y
documentos.

**Clasificación:** Integración/E2E · dificultad Alta · rutas: `/app/admin/matricula`,
`/app/secretaria/matricula` (con `enrollmentDraftGuard`).

### Alcance confirmado al reclamar (Ignacio, 2026-10-18)

Las 3 capas de la ASG entran en este track:

1. **Funcional** — ACs de `0006-m` (refuerzo), `0009-m`/`0010-m` (consentimientos Ley 21.719),
   `0016-m` (plantillas de contrato), `ASG-m-002` (pago antes de la firma), `ASG-m-001` y
   `fix-089-m` (licencia B con 2 años para Profesional), `fix-064-b` (DV del RUT).
2. **E2E manual** — los casos A…Q del checklist, incluidas las sospechas S1–S24.
3. **Playwright** — candidatos "Auto ✓".

Fuera de alcance: matrícula pública `/inscripcion` y Webpay (bloqueadas en el piloto).

**Supuestos al reclamar:**

1. **El checklist (2026-09-29) se actualiza antes de ejecutar.** Varias sospechas ya pueden estar
   resueltas por tracks posteriores (ej. S9 fecha del pago en UTC → la pone la RPC
   `record_enrollment_payment` con `chile_today()` desde fix-050-i; el paso Pago cambió en
   fix-050/052/053/057-i). Las resueltas se ejecutan como regresión, no como sospecha.
2. **Datos de prueba:** las matrículas reales se crean al final, con RUT y N° de documento de
   prueba (`QA-058-*`), y se listan acá para limpiarlas.
3. **SQL:** los tests de BD los corre Ignacio en el SQL Editor; escriben en sub-bloques que
   abortan y no dejan datos.

## ACs Afectados

Ninguno de una spec: es un track de testing. Los ACs de las specs del alcance se verifican como
casos del checklist.

## Cambio

Ninguno de código en este track. Cada bug va a su propio fix/hotfix.

## Test de Regresión

- Los casos del checklist `specs/testing-piloto/023-matricula-presencial.md` con su resultado.

## Progreso

- [ ] Bloque 0 — actualizar el checklist (sospechas ya resueltas, casos nuevos de fix-050/052/053/057-i).
      En curso: 15/24 sospechas revisadas contra el código actual (2026-10-18).
- [ ] Bloques de ejecución (se definen en el Bloque 0).

### Bloque 0 — sospechas contra el código actual (lectura, sin datos)

| # | Estado hoy | Evidencia |
|---|---|---|
| S1 contrato sin sesión | ✅ resuelta | `generate-contract-pdf` llama `requireStaff(req, ['admin','secretary'])` |
| S2 "no se confirmó" pero quedó activa | ✅ resuelta | `confirmEnrollment()` registra el consentimiento **antes** de activar y reusa el número en el reintento |
| S3 horarios ya pasados | ✅ resuelta | `fix-228-b`: la vista filtra `> now()` en hora de Chile |
| S4 DV reemplaza el último dígito | ✅ resuelta | `fix-213-b`: `completeRutDv` solo completa si falta, nunca reemplaza |
| S5 consentimiento promocional pegado | ✅ resuelta | `reset()` limpia ambos consentimientos |
| S7 corregir el RUT no se guarda | ❌ sigue | `upsertUser` con `userId` conocido: el `UPDATE` no incluye `rut` |
| S8 pagos de un borrador descartado/expirado se borran | ❌ sigue | `cleanup_expired_drafts` (fix-393) hace `DELETE FROM payments` de los borradores expirados |
| S9 fecha del pago en UTC | ✅ resuelta | `record_enrollment_payment` pone `chile_today()` (fix-050-i) |
| S10 errores de Pago/Documentos no se muestran | ❌ sigue | el wizard solo pinta `enrollment.error()`; nadie pinta `payment.error()` y `documents.component.html` no muestra `uploadError`. Ahora pesa más: los avisos de caja cerrada (fix-051-i) y de la RPC (fix-050-i) quedarían mudos en el paso Pago |
| S13 admin "mueve" de sede al alumno | ❌ sigue | `upsertUser` escribe `branch_id` = sede de la matrícula sobre el usuario existente |
| S14 código SENCE no se guarda | ❌ sigue | `loadSenceCodes()` no tiene llamadores: `_senceCodeMap` vacío → `sence_code_id` siempre `null` |
| S22 edad un día antes | ✅ resuelta | `calcAge` usa `toChileDate` + `chileToday()` |

Pendientes de revisar: S6, S11, S12, S15–S21, S23, S24.
