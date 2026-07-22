# Asignación ASG-029 — Fix H-022 + H-030: vista previa de contrato y contenido genérico

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

2 hallazgos del mismo módulo (generación de contrato de matrícula):
- **H-022**: en el wizard interno, el HTML de vista previa del contrato tiene estructura y redacción distinta al PDF real generado ("CONTRATO DE PRESTACIÓN DE SERVICIOS DE ENSEÑANZA DE CONDUCCIÓN" vs "...SERVICIOS EDUCACIONALES" en el PDF), y la vista previa muestra la fecha vacía mientras el PDF real sí la trae correcta. El PDF (documento oficial) está bien formado — el problema es solo el HTML de preview.
- **H-030**: el contrato usa idénticamente el mismo texto genérico para Clase B y Profesional — no menciona el curso profesional (A2), la promoción, ni condiciones específicas (evaluaciones, examen final).

## Alcance sugerido

- H-022: alinear el HTML de vista previa con el contenido/estructura real del PDF generado, incluyendo que la fecha se calcule igual en ambos lugares.
- H-030: agregar contenido específico para matrículas Profesional (mención del curso/promoción, cláusulas de evaluación/examen final) en vez de reutilizar el texto genérico de Clase B.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgos H-022 y H-030.

## Notas para quien la reclame

- Prioridad baja: el PDF real (el documento legalmente vinculante) ya está bien — el riesgo es solo de confusión visual para quien lee la preview antes de firmar.
