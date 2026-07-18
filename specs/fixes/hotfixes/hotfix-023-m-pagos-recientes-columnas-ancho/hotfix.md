# Hotfix: columna Concepto ocupa demasiado espacio en "Pagos Recientes"

## Problema
Misma clase de bug que hotfix-022 pero en "Pagos Recientes" (admin y
secretaria): `grid-cols-7` pareja (Fecha, Alumno, Concepto, Monto, Método,
N° Documento, Estado). Concepto tiene valores cortos y fijos ("Matrícula",
"Online", "Abono", etc.) y le sobra espacio, mientras Alumno se trunca.

A diferencia de la tabla de deudores, esta fila SÍ depende de la clase literal
`lg:grid-cols-7` para el modo compacto (`.force-compact .lg\:grid-cols-7`
en los estilos del componente) — no se puede quitar esa clase sin romper el
colapso a columna cuando el drawer está abierto.

## Fix
Agregar una clase adicional `pagos-grid-cols` (sin quitar `grid-cols-7` /
`lg:grid-cols-7`) al header y a cada fila, y overridear el ancho de columnas
con un selector de mayor especificidad (dos clases combinadas, sin
`!important`) para no interferir con el `!important` de `.force-compact`:

```
.pagos-grid-cols.grid-cols-7,
.pagos-grid-cols.lg\:grid-cols-7 {
  grid-template-columns: 0.9fr 1.6fr 0.8fr 1fr 1fr 1fr 1fr;
}
```

Aplicado en `admin-pagos.component.ts` y `secretaria-pagos.component.ts`.

## AC
- La columna Alumno en "Pagos Recientes" tiene más espacio y trunca menos.
- La columna Concepto se reduce, proporcional a su contenido corto.
- El modo compacto (`force-compact`, drawer abierto) sigue colapsando la fila a columna igual que antes.

## Cierre
- Clase `.pagos-grid-cols` agregada (junto a `grid-cols-7`/`lg:grid-cols-7`, sin removerlas) al header y a cada fila de "Pagos Recientes" en `admin-pagos.component.ts` y `secretaria-pagos.component.ts`.
- CSS con selector combinado de doble clase (sin `!important`) da más espacio a Alumno y menos a Concepto, sin interferir con el colapso `.force-compact` (drawer abierto), que sigue usando `!important` y gana igual que antes.
- `tsc --noEmit` limpio.
