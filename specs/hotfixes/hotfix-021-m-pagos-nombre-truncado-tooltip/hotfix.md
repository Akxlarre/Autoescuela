# Hotfix: nombres truncados sin forma de leerlos completos en Pagos

## Problema
En "Alumnos con saldo pendiente" y "Pagos Recientes" (admin y secretaria), el
nombre del alumno usa `truncate` (ahora más largo tras hotfix-020, que agrega
apellido materno) y se corta con "…" sin ninguna forma de ver el texto completo.

- `admin-pagos.component.ts:163-164` (deudores) y `:391-392` (recientes)
- `secretaria-pagos.component.ts:150-151` (deudores) y `:361-362` (recientes)

## Fix
Agregar `[title]="alumno.alumno"` / `[title]="pago.alumno"` (tooltip nativo del
navegador) al `<span>` truncado en los 4 puntos. Cero dependencias nuevas,
funciona igual en ambos roles y es consistente con el resto de truncados
simples del proyecto que no usan PrimeNG Tooltip.

## AC
- Al hacer hover sobre un nombre truncado en cualquiera de las 2 listas (admin y secretaria), se puede leer el nombre completo vía tooltip nativo.

## Cierre
- `[title]` agregado a los 4 spans truncados (deudores + recientes, admin + secretaria).
- `tsc --noEmit` limpio.
