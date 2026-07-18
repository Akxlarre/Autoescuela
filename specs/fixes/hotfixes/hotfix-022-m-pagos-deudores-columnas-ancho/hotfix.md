# Hotfix: columna RUT ocupa demasiado espacio en "Alumnos con saldo pendiente"

## Problema
La tabla de "Alumnos con saldo pendiente" (admin y secretaria) usa `grid-cols-6`
(6 columnas de igual ancho: Alumno, RUT, Total, Pagado, Saldo, Acciones). El RUT
es un valor corto de ancho fijo (ej. "17.009.287-2") y le sobra espacio, mientras
que el nombre del alumno (ahora más largo tras hotfix-020, incluye apellido
materno) se trunca innecesariamente.

## Fix
Reemplazar el `grid-cols-6` parejo por una clase custom `.deudores-grid-cols`
con `grid-template-columns: 2fr 0.8fr 1fr 1fr 1fr 1.2fr`, dándole más espacio a
Alumno y menos a RUT. Aplicado en el header y en cada fila de datos, tanto en
`admin-pagos.component.ts` como en `secretaria-pagos.component.ts`.

## AC
- La columna Alumno en "Alumnos con saldo pendiente" tiene visiblemente más espacio y trunca menos nombres.
- La columna RUT ocupa menos espacio, proporcional a su contenido.
- No se rompe el modo compacto existente (`force-compact` / `deudores-compact` cuando el drawer está abierto, en admin).

## Cierre
- Nueva clase `.deudores-grid-cols` (`grid-template-columns: 2fr 0.8fr 1fr 1fr 1fr 1.2fr`) aplicada al header y a cada `.deudores-row` en `admin-pagos.component.ts` y `secretaria-pagos.component.ts`, reemplazando el `grid-cols-6` parejo.
- No interfiere con `.deudores-compact`/`force-compact` (esos overrides usan `!important` y siguen ganando cuando el drawer está abierto).
- `tsc --noEmit` limpio.
