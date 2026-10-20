# Hotfix: Certificación pinta en verde solo las prácticas completas
> id: hotfix-165-m-certificacion-practicas-incompletas-no-en-verde
> refs: fix-447-m-testing-documentos-certificacion (L08, S23)
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Problema
La columna Prácticas (tabla y tarjetas) usaba siempre `text-success`: "7/12" se veía en verde como
si estuviera completo. El comentario decía "siempre 12/12 si aparece en esta lista", que dejó de
ser cierto para el admin (ve a todos los alumnos, también los incompletos).

## Cambios
- **Archivo:** `src/app/shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component.ts`
  — verde (`text-success`) si `clasesCompletadas >= clasesTotales`, ámbar (`text-warning`) si no;
  en la tabla y en las tarjetas. Verificado en navegador.
