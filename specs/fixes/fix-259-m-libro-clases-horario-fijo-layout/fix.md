# Fix: Horario fijo del Libro de Clases — mover a la cabecera con los otros 7 datos
> id: fix-259-m-libro-clases-horario-fijo-layout
> refs: fix-258-m-libro-clases-horario-fijo
> status: done
> closed: 2026-09-22
> created: 2026-09-22

## Root Cause
fix-258-m dejó el Horario fijo, pero como una fila de solo lectura dentro de la sección
"Datos del Libro de Clases" (junto al input de Código SENCE). El dueño pidió que viva
arriba, junto a los otros 7 datos de cabecera (Autoescuela, Curso, ID, Promoción, Fecha
inicio, Fecha término, Dirección) — ahí ya había espacio libre en la columna derecha.

## ACs Afectados
Ninguno — ajuste visual puntual sobre fix-258-m.

## Cambio
- **`src/app/features/libro-de-clases/libro-de-clases.component.ts`**: mueve la fila
  `Horario: {{ fixedHorario }}` del bloque "Datos del Libro de Clases" a la grilla de
  cabecera (columna derecha, después de "Dirección"). Elimina el bloque `<div>` con label
  standalone que quedaba en la sección de edición.

## Test de Regresión
- Visual — `/verify` en `/app/admin/libro-de-clases`: la fila "Horario" aparece en la
  cabecera junto a Dirección, y ya no se repite en "Datos del Libro de Clases".
