# Asignación ASG-032 — Fix H-036: flash de texto incorrecto en Pagos de alumno Clase B

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

Al navegar a "Pagos y Clases" como alumno de Clase B justo tras el login, por una fracción de segundo se ve el subtítulo "Resumen de pagos de tu matrícula profesional" (el valor por defecto de `heroSubtitle` en `alumno-pagos.component.ts:205-212`, que depende de `facade.isClassB()` — falso mientras la matrícula no ha cargado) antes de cambiar correctamente a "Paga tu saldo pendiente para completar tu matrícula". Cosmético, dura menos de un segundo, pero es un mensaje de negocio incorrecto mientras carga.

## Alcance sugerido

- Cambiar el valor por defecto de `heroSubtitle` en `alumno-pagos.component.ts:205-212` a un texto neutro (o vacío/skeleton) mientras `facade.isClassB()` no está resuelto, en vez de asumir "profesional" como default.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-036.

## Notas para quien la reclame

- Fix trivial, un solo archivo — buen candidato para alguien con poco tiempo. Considerar agruparlo junto con **ASG-005** si la misma persona ya está tocando `alumno-pagos` por otro motivo (no hay overlap de archivo hoy, pero es un área relacionada).
