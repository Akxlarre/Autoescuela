# Asignación ASG-m-007 — Tema fijo por número de clase en Ficha Técnica (Clase B) + edición en Ajustes

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-14
> **created_by:** m
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

En el detalle de un alumno de Clase B, en la sección Ficha Técnica, hay que mostrar el
contenido/tema de cada clase, que es fijo según el número de clase en orden. Esto debe verse
tanto para admin/secretaria como para el instructor en su propio portal. Además, hay que
agregar en Ajustes una sección exclusiva para admin donde se puedan editar los temas de las
12 clases (aunque de partida deben quedar cargados con los valores por defecto de abajo).

Los 12 temas por defecto, en orden de clase 1 a 12:

1. Psicotécnico / Pre-conducción
2. Partidas y detenciones
3. Reducciones
4. Refuerzo reducciones
5. Retrocesos
6. Estacionamiento subida y bajada
7. Estacionamiento
8. Refuerzo estacionamiento
9. Tránsito urbano I
10. Tránsito urbano II
11. Tránsito urbano III
12. Mecánica + preparación examen

## Alcance sugerido

- Mostrar el tema correspondiente a cada clase en la Ficha Técnica del detalle de alumno
  Clase B, tanto en la vista de admin/secretaria como en el portal del instructor.
- Nueva sección en Ajustes, solo visible/editable para admin, donde se listan las 12 clases
  con su tema y se pueden editar.
- Seedear los 12 temas por defecto listados arriba (probablemente vía migración).
- Definir dónde vive esta data: probablemente una tabla de configuración
  (`class_topics` o similar) en vez de hardcodear el texto en el componente, para que sea
  editable desde Ajustes.

## Referencias

- Imagen de referencia con los 12 temas en orden (adjuntada por el dueño en la conversación
  original de esta asignación).

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno declarado. Probablemente toca Ficha Técnica del detalle de alumno Clase B (vista
  admin/secretaria e instructor), y una nueva sección en Ajustes.

## Notas para quien la reclame

- Consultar `indices/DATABASE.md` antes de crear la tabla/migración nueva.
