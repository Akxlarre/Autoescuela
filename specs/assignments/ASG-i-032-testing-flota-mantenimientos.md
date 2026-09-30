# Asignación ASG-i-032 — Testing: Flota, documentos de vehículo y mantenimientos

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Checklist detallado:** `specs/testing-piloto/032-flota-mantenimientos.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

Gestión de vehículos: ficha, documentos (SOAP, revisión técnica, permiso), mantenimientos y
kilometraje. Es mayormente autocontenido, pero sus vencimientos alimentan las alertas del
dashboard, las notificaciones y la advertencia al agendar.

**Clasificación:** **Funcional** · dificultad **Media** · rutas: `/app/admin/flota`,
`/app/admin/flota/:id/mantenimientos`.

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de spec `0004-m` (vehículos multi-sede), spec `0027-b` (notificaciones de vencimiento),
  `fix-153-m` (UI de carga de documentos), `fix-153-b` (alerta de vencido en el listado),
  `fix-033-m` (ficha técnica / imprimir informe), `ASG-b-037` (egreso de combustible por vehículo).

**2. E2E manual**
- Alta/edición/baja de vehículo; vehículo "ambas sedes".
- Cargar/editar documentos → estados vigente / por vencer / vencido correctos según la fecha.
- Vencido → alerta en el listado, en el dashboard y advertencia al agendar (cruza con `ASG-i-026`).
- Registrar mantenimiento → historial, total invertido; ¿el KM se actualiza?
- Imprimir el informe del vehículo.

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- Documento con fecha vencida sembrada → ícono de alerta en el listado.

## Fuera de alcance

- Ninguno.

## Referencias

- `docs/UAT-PLAN.md` Paquete 5 · specs `0004-m`, `0027-b`

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing).

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación. **Cada bug
  encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
- La secretaria no tiene ruta de Flota: confirmar que es intencional para el piloto.
