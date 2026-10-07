# Hotfix: Libro de clases — doble guardado del código SENCE y textos menores
> id: hotfix-146-m-libro-de-clases-doble-guardado-y-textos
> refs: ASG-i-025, fix-319-m (Q08, P03, O03, R02)
> status: done
> closed: 2026-10-07
> created: 2026-10-07

## Problema
Detalles anotados en el bloque 4 del testing de Clase Profesional:
- Doble clic en "Guardar" del código SENCE escribe dos veces (2 `PATCH class_book`) (Q08).
- "Lista de Clase (1 alumnos)" y "1 alumnos" en Resumen Asistencia: sin singular.
- El selector de promoción y la cabecera repiten el número: "Promoción 280 (5 de Octubre 2026)
  (280)". Desde `fix-323-m` el nombre ya trae el número.
- La portada del PDF dice "CURSO PROFESIONAL CLASE A2"; el libro físico dice "CLASE A-2" (las
  convalidaciones ya llevan guion) (R02).

## Cambios
- **Facade del libro:** un segundo "Guardar" mientras el primero está en curso se ignora.
- **Pantalla del libro:** singular/plural de "alumno(s)" en Lista de Clase y Resumen; el número de
  la promoción se agrega entre paréntesis solo si el nombre no lo trae ya (las promociones antiguas
  "Promoción 15 de Junio 2026" lo conservan).
- **Función del PDF** (`generate-class-book-pdf`): la portada escribe la clase con guion ("A-2").
  **La despliega Matías** (va junto con `fix-352-m`, que toca la misma función).

## Verificación
- Test unitario: dos guardados simultáneos → una sola escritura.
- Revisión en navegador de los textos; la portada se revisa en un PDF nuevo después del despliegue.
- Revisado en navegador (admin, 2026-10-07): el selector muestra "Promoción 281 (19 de Octubre
  2026)" sin repetir el número y "Promoción 15 de Junio 2026 (103)" para las antiguas; "Lista de
  Clase (1 alumno)" / "(2 alumnos)" y lo mismo en Resumen; doble clic en "Guardar" → una escritura.
- Portada revisada tras el despliegue (2026-10-07): el PDF del libro 280.2 dice "CURSO PROFESIONAL
  CLASE A-2".
