# Fix: Indicador de carga por cada ficha PDF pedida
> id: fix-316-m-indicador-de-carga-por-cada-ficha-pdf-pedida
> refs: ASG-i-024
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Root Cause
La lista de alumnos recuerda qué ficha PDF se está generando en un solo valor (`_isGeneratingFicha: number | false`), el id de una matrícula. Si se piden dos fichas seguidas, la segunda pisa a la primera: el botón de la primera deja de girar y vuelve a quedar habilitado aunque su PDF siga generándose, y cuando termina cualquiera de las dos el valor vuelve a `false` y se apaga también el indicador de la otra. Anotado en `024a` J05 de `fix-264-m`.

## ACs Afectados
- `024a` J05: cada fila (y cada tarjeta) muestra su indicador de carga, y queda deshabilitada, desde que se pide su ficha hasta que esa ficha termina, sin importar cuántas otras se pidan mientras tanto.

## Cambio
- **Archivo:** el facade de la lista de alumnos — lleva el conjunto de matrículas con ficha en curso (`generatingFichaIds`) en vez de un solo id.
- **Archivos:** las dos pantallas de la lista (admin y secretaria), el componente de la lista y la tarjeta de alumno — reciben ese conjunto y preguntan por su matrícula.

## Test de Regresión
- Spec del facade de la lista > "fichas PDF en paralelo — fix-316-m" ✓: con dos fichas pedidas, al terminar la segunda la primera sigue marcada, y al terminar la primera no queda ninguna.

## Verificación
2026-10-05: 96 tests en verde (facade, componente de la lista y tarjeta); sin errores de compilación. No se comprobó en navegador con dos PDF reales en paralelo.
