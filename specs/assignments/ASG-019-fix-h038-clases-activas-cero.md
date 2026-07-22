# Asignación ASG-019 — Fix H-038: "Clases activas" de Instructores siempre muestra 0

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Los 6 instructores muestran "0" en la columna/KPI "Clases activas", sin excepción — incluso los que en ese momento tenían clases "Transcurriendo" según el Dashboard. `instructores.facade.ts:622` lee `activeClassesCount: r.active_classes_count` directamente de la columna `instructors.active_classes_count` (`DEFAULT 0`), pero esa columna nunca se escribe en ningún trigger, Edge Function o facade de todo el repo — quedó definida en el esquema pero nunca conectada a la lógica real.

## Alcance sugerido

- Reemplazar la lectura de la columna cacheada por un `COUNT` en vivo en la misma query del facade — ej. sesiones de `class_b_sessions`/`professional_sessions` con `scheduled_at` de hoy y sin asistencia registrada aún.
- Evaluar si la columna `active_classes_count` debería eliminarse del esquema (si no tiene otro uso) o si conviene mantenerla como cache futuro con un trigger que sí la actualice — decisión de diseño menor, documentar la elección.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-038 — nota que es el mismo patrón de riesgo que H-016 (dato cacheado/mock que se desincroniza de la realidad).

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/instructores.facade.ts`

## Notas para quien la reclame

- No bloquea ningún flujo, pero es un dato falso y consistente que un admin podría usar para evaluar carga de trabajo sin saber que nunca refleja la realidad.
