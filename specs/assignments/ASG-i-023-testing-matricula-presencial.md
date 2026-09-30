# Asignación ASG-i-023 — Testing: Matrícula presencial (Clase B, refuerzo y Clase Profesional)

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Checklist detallado:** `specs/testing-piloto/023-matricula-presencial.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

La matrícula presencial es el flujo de entrada de dinero y alumnos del piloto, y el que más
módulos toca a la vez: crea alumno + matrícula, agenda clases (Triple Match), genera contrato,
registra el primer pago, sube documentos al DMS, crea la cuenta del alumno y dispara
notificaciones. Un error acá se propaga a agenda, pagos, cuadratura y documentos.

**Clasificación:** **Integración/E2E** · dificultad **Alta** · rutas: `/app/admin/matricula`,
`/app/secretaria/matricula` (con `enrollmentDraftGuard`).

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de spec `0006-m` (refuerzo 6 clases), `0009-m` / `0010-m` (consentimientos Ley 21.719),
  `0016-m` (plantillas de contrato), `ASG-m-002` (orden pago antes de firma), `ASG-m-001`
  (años de licencia en Profesional), `fix-089-m` (licencia B 2 años para Profesional),
  `fix-064-b` (DV del RUT automático).

**2. E2E manual**
- Matrícula Clase B completa (12 clases), pago total y abono → verificar después que aparece en
  Base de Alumnos, Agenda (slots ocupados), Pagos, Cuadratura del día y Documentos.
- Matrícula de refuerzo (6 clases) y matrícula Profesional (A2/A3/A4) con sus validaciones de
  edad / años de licencia.
- Alumno que ya existe (mismo RUT) con 2ª matrícula → aviso, precarga de datos y foto, ambas
  matrículas separadas en ficha y DMS.
- Bloqueo de re-matrícula con matrícula activa del mismo curso.
- Abandonar a mitad → `enrollmentDraftGuard` avisa; volver → retoma el borrador.
- Descuento predefinido (% y fijo) y descuento manual → montos correctos en contrato y pago.
- Errores a mitad de camino (email duplicado, fallo de red simulado) → no queda matrícula a medias
  ni el botón atascado (`fix-151-b` fue de este tipo).
- Admin con "Todas las sedes" vs secretaria → la matrícula queda en la sede correcta.

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- Happy path Clase B de punta a punta + asserts en Base de Alumnos y Pagos.
- Validaciones bloqueantes (edad, RUT, re-matrícula activa) parametrizadas.
- Retomar borrador tras recargar.

## Fuera de alcance

- Matrícula pública online `/inscripcion` (bloqueada en el piloto) y pago Webpay.

## Referencias

- `docs/UAT-PLAN.md` Paquetes 1 y 2 · `indices/DOMAIN-GOTCHAS.md`
- Specs `0006-m`, `0009-m`, `0010-m`, `0016-m`

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing). Hallazgos probablemente en `features/*/matricula*`,
  `core/facades/enrollment*.facade.ts`.

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación. **Cada bug
  encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
- Coordinar con `ASG-i-026` (Agenda) y `ASG-i-028` (Pagos): este flujo es la entrada de ambos.
