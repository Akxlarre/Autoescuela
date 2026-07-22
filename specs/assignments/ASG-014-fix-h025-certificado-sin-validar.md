# Asignación ASG-014 — Fix H-025 + H-012: certificado B sin validar 12 prácticas + falta indicador de criterio

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

- **H-025 (el más grave de los dos)**: `supabase/functions/generate-certificate-b-pdf/index.ts` (215 líneas) nunca valida que existan 12 `class_b_sessions` completadas antes de emitir el PDF — solo valida que el `enrollment_id` exista. El admin ve TODOS los alumnos activos/completados sin el filtro `certificate_enabled` (a diferencia de secretaría), así que el botón "Generar" está disponible hoy para alumnos con 0/12 prácticas. Es un problema de integridad de negocio y potencial cumplimiento normativo (el PDF cita la Ley N° 19.628).
- **H-012 (menor, relacionado)**: la diferencia de criterio "elegible" entre admin (sin filtro) y secretaría (`certificate_enabled=true`) es intencional y está documentada en el código (`certificacion-clase-b.facade.ts:400-431`), pero la UI nunca comunica esta diferencia — un admin y una secretaría comparando pantallas concluirían que el sistema está roto.

## Alcance sugerido

- H-025: agregar validación `clasesCompletadas >= 12` en el Edge Function (la barrera real, server-side) — esto es lo que corrige el riesgo de negocio.
- H-025 (UI): deshabilitar visualmente el botón "Generar" en `admin/certificacion` cuando el alumno no cumple el criterio, en vez de dejarlo disponible sin impedimento.
- H-012: agregar un indicador visible ("Vista admin: todos los estados" vs "Vista secretaría: solo habilitados") — bajo esfuerzo, alto valor para evitar confusión entre roles.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgos H-025 y H-012 (con el fragmento de código exacto que documenta la diferencia intencional).

## Archivos involucrados (opcional, para detectar solapes)

- `supabase/functions/generate-certificate-b-pdf/index.ts`
- `src/app/core/facades/certificacion-clase-b.facade.ts`
- `src/app/features/admin/certificacion/admin-certificacion.component.ts`

## Notas para quien la reclame

- H-025 es prioridad alta real — el camino de explotación ya existe hoy en producción, no requiere bypasear nada.
- H-012 es solo UI/copy, se puede resolver en el mismo track sin mucho esfuerzo adicional.
