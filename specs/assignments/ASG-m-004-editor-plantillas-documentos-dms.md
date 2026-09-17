# Asignación ASG-m-004 — Editor de plantillas para contratos y certificados generados por Edge Function

> **status:** completada
> **owner:** m
> **tipo_sugerido:** spec
> **priority:** P1
> **created:** 2026-09-14
> **created_by:** m
> **claimed_by:** m
> **claimed_at:** 2026-09-16
> **resulting_track:** 0016-m-editor-plantillas-documentos

---

## Contexto / Objetivo

En DMS Documentos, en las secciones de documentos de la escuela y/o plantillas, se necesita
poder editar el contenido de los documentos que hoy se generan "hardcodeados" vía Edge
Function: el contrato Clase B, el contrato Profesional, el certificado Clase B y el
certificado Profesional, de ambas escuelas (8 documentos en total, o los que correspondan
según la combinación escuela × tipo). El objetivo es que una persona sin conocimientos de
programación (similar a la sección Configuración Web existente) pueda editar el contenido
de estos documentos por sección/párrafo, sin tocar código. Debe ser una funcionalidad
exclusiva de admin.

## Alcance sugerido

- Editor de contenido por sección/párrafo para cada plantilla (contrato B, contrato
  profesional, certificado B, certificado profesional × 2 escuelas).
- Vista previa del documento antes de guardar los cambios.
- Considerar cómo evitar que el documento se rompa visualmente si se agrega demasiado
  texto en una sección (el propio dueño reconoce que esto es complejo de resolver del
  todo — no se espera una solución perfecta, sí una razonable: límites de caracteres,
  ajuste automático de tamaño de fuente, o advertencias al editor).
- Solo accesible para rol admin.
- La Edge Function que genera el PDF/documento final debe pasar a leer el contenido editado
  en vez de tener el texto hardcodeado.

## Referencias

- Ver cómo está resuelta la sección Configuración Web existente, como referencia de UX para
  este tipo de edición de contenido por personas no técnicas.

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno declarado. Probablemente toca las Edge Functions que generan contratos/certificados,
  DMS Documentos (secciones de documentos de escuela/plantillas), y posiblemente una tabla
  nueva para almacenar el contenido editable de cada plantilla.

## Notas para quien la reclame

- Esta es la asignación más grande y ambigua del batch — vale la pena discutir el diseño
  técnico (¿plantilla con placeholders + secciones editables? ¿HTML enriquecido con límites?)
  con el dueño antes de comprometerse a un plan.
