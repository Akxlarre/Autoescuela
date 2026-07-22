# Asignación ASG-027 — Fix H-003: Ex-Alumnos B — conteo de egresados discrepante (2 vs 16)

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

En `/app/admin/ex-alumnos` con "Todas las sedes", el hero/KPI dice "2 Egresados" mientras la sección "Balance de Gestión Anual (REAL-TIME)" de la misma página dice "16 egresados" — dos fuentes de datos distintas mostrando lo mismo, sin conciliar. Posible hipótesis: una filtra por sede/clase y la otra no, o usan criterios de "egresado" distintos.

## Alcance sugerido

- Localizar las 2 queries/cálculos distintos que alimentan cada número en `admin/alumnos/ex-alumnos` (o su facade correspondiente).
- Determinar cuál es el criterio correcto de "egresado" (¿certificado emitido? ¿12/12 clases completadas? ¿matrícula con status='completed'?) y unificar ambas fuentes a ese criterio.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-003.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/ex-alumnos.facade.ts` (componente Smart exacto de "Ex-Alumnos B" no confirmado — verificar routing bajo `admin/alumnos`)

## Notas para quien la reclame

- Similar en espíritu a H-013 (dos fuentes de verdad sin conciliar) — vale la pena revisar si comparten un patrón de causa raíz común en el repo (facades con queries duplicadas para el mismo concepto).
