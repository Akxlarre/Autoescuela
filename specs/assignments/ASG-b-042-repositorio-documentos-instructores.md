# Asignación ASG-b-042 — Repositorio de documentos: sección Instructores + poder abrir el archivo

> **status:** completada
> **owner:** m
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-07-28
> **created_by:** b
> **claimed_by:** m
> **claimed_at:** 2026-07-29
> **resulting_track:** 0003-m-repositorio-documentos-instructores

---

## Contexto / Objetivo

Anotación de la reunión (2026-07-28), una sola viñeta con dos partes:

> *"Añadir opción ver instructores en el repositorio de documentos que tenemos.
> Añadir opción ver pruebas documentos."*

### Parte 1 — sección de Instructores

Hoy el repositorio solo cubre alumnos: las rutas existentes son `/app/admin/documentos` y
`/app/admin/documentos/alumnos/:id` (+ los equivalentes de secretaría). Falta la sección
paralela para **documentos de los instructores** (licencia, antecedentes, etc.).

### Parte 2 — "ver pruebas documentos"

Interpretación confirmada con el owner (2026-07-28): **poder abrir/previsualizar el archivo**
de un documento, no solo ver su estado (aprobado/pendiente). "Pruebas" = el respaldo.

> ⚠️ **El owner la dio como probable, no como certeza.** Confirmar con el cliente antes de
> construir. Las otras dos lecturas descartadas eran: (a) ver los ensayos/exámenes rendidos por
> el alumno dentro del repositorio, (b) poder adjuntar la hoja física de la prueba rendida —
> hoy `class_b_exam_scores` es *"ingreso manual"* del puntaje, sin lugar para escanear la hoja.
> Si resulta ser (b), esto deja de ser un fix chico y necesita migración.

## Preguntas abiertas (parte del entregable, no bloqueantes)

1. **¿Qué documentos necesitamos de los instructores para cumplir la ley?** El cliente pidió
   explícitamente que esta pregunta se haga como parte de la tarea. No inventar la lista:
   investigarla y validarla con el cliente antes de fijar el enum de tipos de documento.
2. Confirmar la interpretación de "ver pruebas documentos" (arriba).

## Alcance sugerido

- Sección/ruta de documentos de instructores, en paralelo a la de alumnos.
- Tipos de documento derivados de la respuesta a la pregunta 1.
- Visor de archivo. **Ya existe la pieza**: `src/app/core/facades/dms.facade.ts:171` genera
  `createSignedUrl(path, 3600)`. Verificar si `student_documents` tiene el mismo visor o solo
  `school_documents`, y extenderlo donde falte.

## Referencias

- `indices/ROUTES.md` líneas 46-47, 78-79 (rutas de documentos existentes)
- `src/app/core/facades/dms.facade.ts:171` (signed URL ya implementado)
- `indices/DATABASE.md` → `school_documents`, `student_documents` (ojo: `storage_url` guarda
  **path relativo**, no URL pública, desde `20260413000001`)

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/dms.facade.ts`
- `src/app/app.routes.ts`
- Features de documentos admin/secretaría

## Notas para quien la reclame

- La pregunta legal (1) tiene peso propio: los documentos de un instructor son **datos
  personales de un trabajador**. Antes de definir qué se guarda y por cuánto tiempo, vale la
  pena pasar por el skill `compliance-cl` (Ley 21.719, vigencia dic-2026) — no como trámite,
  sino porque define qué campos existen.
