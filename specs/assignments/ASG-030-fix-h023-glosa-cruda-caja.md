# Asignación ASG-030 — Fix H-023: Caja Diaria muestra glosa cruda del pago

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

En `/app/secretaria/contabilidad/cuadratura`, la tabla "Registro de Ingresos" columna "GLOSA / ALUMNO" muestra literalmente `online` y `enrollment` (valores de código, en inglés y minúscula) en vez del nombre del alumno o un concepto legible como "Matrícula" — que sí se usa correctamente en la página Pagos → Pagos Recientes, para las mismas transacciones.

## Alcance sugerido

- Reutilizar el mismo mapeo/pipe que ya usa la página Pagos para transformar el código crudo del origen del pago en un concepto legible, aplicándolo también en Caja Diaria.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-023.

## Notas para quien la reclame

- Fix simple — el mapeo correcto ya existe en otra página, solo hace falta reutilizarlo acá.
