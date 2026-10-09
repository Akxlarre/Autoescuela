# Hotfix: textos menores de la Base de Alumnos Profesional
> id: hotfix-147-m-textos-menores-de-la-base-profesional
> refs: ASG-i-025, fix-319-m (F01, D06, G06)
> status: done
> closed: 2026-10-07
> created: 2026-10-07

## Problema
Detalles de texto anotados en los bloques 2 y 5 del testing de Clase Profesional:
- El paginador dice "Mostrando 1 a 10 de 65 **alumnos**" y lo que cuenta son matrículas (D10; el
  chip y el KPI ya dicen "matrículas") (F01).
- El chip del encabezado dice "1 matrículas", sin singular (D06).
- La lista vacía siempre dice "No hay alumnos profesionales · Ajusta los filtros o registra nuevas
  matrículas profesionales · Limpiar filtros", también en la Papelera vacía y sin filtros puestos
  (G06).

## Cambios
- `alumnos-profesional-list-content.component.ts`: paginador "matrículas"; chip con
  singular/plural; el estado vacío distingue tres casos, igual que la Base B: con filtros ("No se
  encontraron alumnos" + "Limpiar filtros"), Papelera vacía ("No hay alumnos archivados") y lista
  vacía sin filtros ("Aún no hay alumnos profesionales"), estos dos sin botón.

## Verificación
- Test unitario: chip "1 matrícula" / "2 matrículas"; los tres estados vacíos.
- Revisión en navegador: paginador, Papelera vacía y búsqueda sin resultados.
- Hecho (2026-10-07): tests 19/19 del archivo, `tsc` y `lint:arch` sin errores. En navegador
  (admin, 1440 px): paginador "Mostrando 1 a 10 de 65 matrículas"; búsqueda sin resultados "No se
  encontraron alumnos" con "Limpiar filtros"; Papelera vacía "No hay alumnos archivados", sin
  botón. Consola sin errores. El singular del chip queda cubierto por el test (no hay un caso
  con una sola matrícula en la BD).
- Quedó fuera: los badges `p-tag` conservan fondo claro en modo oscuro. No es de esta pantalla:
  les pasa a todos los `p-tag` de la app (se leen bien); corresponde a un track del design system.
