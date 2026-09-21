# Fix: Tema fijo por número de clase en Ficha Técnica (Clase B) + edición en Ajustes

> **status:** draft
> **owner:** b

## Contexto
En el detalle de un alumno de Clase B, en la sección Ficha Técnica, hay que mostrar el contenido/tema de cada clase, que es fijo según el número de clase en orden. 
Esto debe verse tanto para admin/secretaria como para el instructor en su propio portal.
Además, hay que agregar en Ajustes una sección exclusiva para admin donde se puedan editar los temas de las 12 clases.

## Acceptance Criteria
- [ ] Mostrar el tema correspondiente a cada clase en la Ficha Técnica del detalle de alumno Clase B (vista admin/secretaria e instructor).
- [ ] Nueva sección en Ajustes (solo admin) para editar los 12 temas de las clases.
- [ ] Seedear los 12 temas por defecto vía migración (tabla `class_topics` o similar).
