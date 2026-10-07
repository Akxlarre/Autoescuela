# Hotfix: Textos menores de Promociones y Archivo, y orden de las promociones en la matrícula
> id: hotfix-145-m-textos-menores-de-promociones-y-archivo
> refs: ASG-i-025, fix-319-m (K02, J05, N01, Archivo)
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Problema
Detalles anotados en el bloque 3 del testing de Clase Profesional, ninguno cambia reglas:
- El recuadro "Reglas de negocio" de "Programar Promoción" todavía dice "Inicio solo en lunes,
  cada 2 semanas"; desde `fix-323-m` una manual puede ir en cualquier lunes libre (K02).
- "1 promociones encontradas" en la lista y "1 alumnos inscritos" en el detalle de una promoción
  finalizada: sin singular (J05, Archivo).
- El buscador de Archivo sugiere "ej. Clase 123...", que no es ni un número ni un nombre de
  promoción.
- En el paso 2 de la matrícula Profesional las promociones salen sin orden (280, 282, 281, 278,
  279) (N01).

## Cambios
- **Drawer de crear promoción:** la regla pasa a "Inicio solo en lunes; la cadencia automática es
  cada 2 semanas".
- **Lista de Promociones:** "1 promoción encontrada" / "N promociones encontradas".
- **Detalle de promoción** (compartido por "Ver promoción" y Archivo): "1 alumno inscrito" /
  "N alumnos inscritos".
- **Archivo:** placeholder "Buscar por número o nombre…".
- **Paso 2 de la matrícula:** las promociones se ordenan por fecha de inicio, de la más antigua a
  la más nueva (función pura nueva `sortPromotionGroupsByStart`, usada por el facade de matrícula).

Fuera de este hotfix: el formato de fecha (`05/10/2026` en la tabla, `05-10-2026` en el detalle).
No es propio de Promociones: la app usa los dos (la utilidad compartida `formatDayMonthYear` escribe
con guion; las tablas, con barra). Unificarlo es una decisión de toda la app.

## Verificación
- Test unitario de `sortPromotionGroupsByStart` (orden por fecha; sin fecha, al final) ✓. 187 tests
  en verde en los 9 archivos tocados o vecinos; `tsc` sin errores; `lint:arch` 0 errores
  (2026-10-06).
- Revisión en navegador (admin, 2026-10-06) ✓:
  - Lista: "6 promociones encontradas", "1 promoción encontrada", "0 promociones encontradas".
  - Drawer de crear: "Inicio solo en lunes; la cadencia automática es cada 2 semanas".
  - Archivo: selector con "Buscar por número o nombre…"; promoción 277: "con 1 alumno inscrito."
  - Paso 2 de la matrícula (retomando el borrador de prueba): 278.2, 279.2, 280.2, 281.2, 282.2.
