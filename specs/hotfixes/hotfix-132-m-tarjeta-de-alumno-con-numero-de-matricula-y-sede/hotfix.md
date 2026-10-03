# Hotfix: Tarjeta de alumno con Nº de matrícula y sede
> id: hotfix-132-m-tarjeta-de-alumno-con-numero-de-matricula-y-sede
> refs: ASG-i-024
> status: done
> closed: 2026-10-03
> created: 2026-10-03

## Problema
En la vista de tarjetas (pantalla angosta o con un panel abierto) la tarjeta del alumno no muestra
el Nº de matrícula ni la sede, que sí están en la tabla. El Nº de matrícula es el dato con que la
secretaria identifica al alumno. Encontrado en la 2ª pasada de `fix-264-m` (`024a` H03); decisión
de Matías: la tarjeta debe mostrarlos, en especial el Nº de matrícula.

## Cambios
- **Archivo:** `src/app/shared/components/alumno-card/alumno-card.component.ts` — primer dato del
  cuerpo: "Nº Matrícula" (todas las matrículas B, como la tabla); "Sede" cuando se pide con el
  input nuevo `showSede`.
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` —
  pasa `[showSede]="showSedeColumn()"` a la tarjeta (misma regla que la columna de la tabla).
- **Archivo:** `src/app/shared/components/alumno-profesional-card/alumno-profesional-card.component.ts`
  — primer dato del cuerpo: "Nº Matrícula" (la tabla Profesional no tiene columna Sede).
