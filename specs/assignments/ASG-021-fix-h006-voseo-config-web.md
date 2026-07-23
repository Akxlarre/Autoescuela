# Asignación ASG-021 — Fix H-006: Configuración Web usa voseo argentino

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

La sección Configuración Web usa voseo argentino ("Seleccioná una sede…", "Usá el selector…", "querés editar") mientras el resto de la app usa español de Chile (tuteo). Inconsistencia de tono en una pantalla completa. También se confirmó en el audit (Fase 3, iteración 12) que el voseo se filtró a textos de sistema generados por triggers/Edge Functions, no solo a la UI estática — revisar ambos.

## Alcance sugerido

- Buscar y corregir todas las instancias de voseo en `admin/configuracion-web/**` (copy estático).
- Revisar también notificaciones/mensajes generados por triggers o Edge Functions relacionados a Configuración Web, que heredaron el mismo tono.
- Fuera de scope: no es necesario auditar TODO el repo por voseo — el hallazgo original está acotado a este módulo.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-006.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/features/admin/configuracion-web/**` (glob amplio, no un archivo puntual — varios tabs)

## Notas para quien la reclame

- Solo copy, sin lógica — buen candidato para alguien nuevo en el repo o con poco tiempo disponible.
