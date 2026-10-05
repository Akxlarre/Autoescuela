# Hotfix: Botón de ficha PDF de la tabla con su etiqueta para agentes
> id: hotfix-143-m-boton-de-ficha-pdf-de-la-tabla-con-su-etiqueta-para-agentes
> refs: ASG-i-024
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Problema
En la tabla de la Base de Alumnos B, el botón "Exportar Ficha PDF" de cada fila no tiene el atributo `data-llm-action` que exige la regla de AI-Readability del proyecto. Sus vecinos (ver ficha, archivar, restaurar) sí lo tienen, y el mismo botón en la tarjeta móvil también. Anotado como observación en `fix-264-m`.

## Cambios
- **Archivo:** el componente de la lista de alumnos (`alumnos-list-content`) — `data-llm-action="export-student-row-pdf"` en ese botón, siguiendo el nombre de los demás botones de fila.

## Verificación
Comprobado en navegador: cada fila de la tabla tiene un botón con esa etiqueta.
