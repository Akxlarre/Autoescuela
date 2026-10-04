# Hotfix: Los puntos de firma de las tarjetas de la Ficha Técnica dicen qué significan
> id: hotfix-136-m-firmas-con-texto-en-las-tarjetas-de-la-ficha-tecnica
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Problema
En la vista de tarjetas de la Ficha Técnica, los dos puntos de firma (alumno e instructor) no
tienen texto al pasar el mouse; en la tabla sí ("Alumno firmó", "Firma instructor pendiente").
Desde `fix-290-m` el panel muestra siempre las tarjetas, así que ese texto dejó de verse.
Encontrado en la 3ª pasada de `fix-264-m` (`024b` E03); es B38.

## Cambios
- **Archivo:** `src/app/features/admin/alumno-detalle/components/ficha-tecnica/admin-ficha-tecnica.component.ts`
  — los dos puntos de la tarjeta llevan el mismo `title` que los de la tabla.
- **Archivo:** `e2e/alumnos-b-ficha.spec.ts` — test `D03 · E02 · E03` de la tercera pasada.
