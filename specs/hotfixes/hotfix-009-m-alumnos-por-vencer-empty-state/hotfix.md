# hotfix-009-m — Alumnos por Vencer: botón muerto y drawer vacío sin mensaje

## Problema
En el drawer "Alumnos con Cuotas por Vencer" (Base de Alumnos B):
1. El footer tiene un botón "Descargar Reporte Mora" sin ningún `(click)` —
   no hace nada al presionarlo.
2. Cuando `facade.alumnosPorVencer()` está vacío, el `@for` no renderiza
   nada y el drawer se ve completamente en blanco, sin indicar al usuario
   que no hay alumnos con cuota por vencer.

## Cambio
`alumnos-por-vencer-drawer.component.ts`:
1. Eliminar el botón "Descargar Reporte Mora" del footer (sin funcionalidad
   real detrás, mismo criterio aplicado en hotfix previo de Servicios
   Especiales).
2. Agregar un estado vacío (`@empty` del `@for`) con ícono y texto que
   indique "No hay alumnos con cuotas por vencer".

## Acceptance Criteria
- [x] El botón "Descargar Reporte Mora" ya no aparece en el drawer.
- [x] Cuando no hay alumnos con cuota por vencer, se muestra un mensaje
      explícito en vez de un espacio vacío.
