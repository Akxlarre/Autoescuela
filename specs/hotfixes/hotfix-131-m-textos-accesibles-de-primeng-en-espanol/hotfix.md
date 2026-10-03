# Hotfix: Textos accesibles de PrimeNG en español (paginador y demás)
> id: hotfix-131-m-textos-accesibles-de-primeng-en-espanol
> refs: ASG-i-024
> status: done
> closed: 2026-10-03
> created: 2026-10-03

## Problema
Los botones del paginador de todas las tablas (`p-table` / `p-paginator`) se anuncian en inglés
("First Page", "Previous Page", "Next Page", "Last Page", "Page 2") para lectores de pantalla y
herramientas de accesibilidad. Lo mismo con el resto de textos `aria` de PrimeNG ("Close",
"Select All", etc.): la traducción global solo cubría el calendario. Encontrado en la 2ª pasada de
`fix-264-m` (`024a` R04); decisión de Matías: todo en español.

## Cambios
- **Archivo:** `src/app/app.config.ts` — `providePrimeNG({ translation })` suma el bloque `aria`
  completo en español.
