# hotfix-002-m — Tamaño de fuente "Vence" en Pre-inscritos Profesional

## Problema
En la tabla de Pre-inscritos (clase profesional), la columna "Vence" se renderiza en
`text-xs`, más pequeña que la columna "Fecha" (`text-sm`), generando inconsistencia visual.

## Cambio
`admin-pre-inscritos.component.ts` — unificar las 3 variantes de la celda "Vence"
(Vencido / Xd por vencer / fecha normal) a `text-sm` para igualar a la columna "Fecha".

## Acceptance Criteria
- [x] La columna "Vence" usa el mismo tamaño de fuente (`text-sm`) que la columna "Fecha"
