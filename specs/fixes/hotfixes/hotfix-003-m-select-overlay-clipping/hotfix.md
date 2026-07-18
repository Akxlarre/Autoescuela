# hotfix-003-m — Overlay de p-select cortado detrás de la tabla (Pre-inscritos Profesional)

## Problema
En la vista de Pre-inscritos Clase Profesional, los dos `p-select` de filtros
("Todos los estados" y "Todas las clases") abren su panel de opciones y este
queda recortado/detrás de la card de la tabla de abajo, en vez de flotar por
encima. Otras vistas del proyecto (ej. detalle de alumno, dropdown "Carnet")
ya resuelven esto correctamente.

## Causa
El overlay de `p-select` se monta inline dentro del stacking context de la card
de filtros, y queda debajo del `z-index`/stacking de la card de la tabla. El
patrón ya usado en el resto del proyecto (`admin-profesional-archivo`,
`admin-secretarias`, `dms-upload-drawer`, `assignment`) es usar `appendTo="body"`
para que PrimeNG monte el panel directamente en `<body>`.

## Cambio
`admin-pre-inscritos.component.ts` — agregar `appendTo="body"` a los dos
`p-select` de filtros (estado y clase/licencia).

## Acceptance Criteria
- [x] El panel de opciones de ambos `p-select` se renderiza por encima de la
      tabla de resultados, sin recortarse.
