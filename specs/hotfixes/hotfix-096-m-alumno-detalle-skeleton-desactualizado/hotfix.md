# Hotfix: Ficha de alumno — el skeleton de carga no refleja el rediseño de 3 columnas
> id: hotfix-096-m-alumno-detalle-skeleton-desactualizado
> refs: 0006-i-app-like-alumno-detalle
> status: done
> closed: 2026-08-31
> created: 2026-08-31

## Problema
`AdminAlumnoDetalleComponent` fue rediseñado (layout de 3 columnas horizontales fill-screen,
commit 8c35a044 y siguientes) pero el bloque `@if (facade.isLoading())` del mismo template no
se actualizó junto con el contenido real. Diferencias visibles entre el skeleton y la vista
cargada:

1. **Columna 1 (Info Personal):** el skeleton termina tras los 3 pares label/valor
   (EMAIL / TELÉFONO / FECHA DE INGRESO). La vista real tiene además, bajo un divisor, un
   bloque grande de acciones: `grid grid-cols-2` de 6 botones + 2 botones full-width
   (Consentimientos, Reagendamientos). El skeleton queda muy corto → salto de layout.
2. **Columna 2 (Progreso):** el skeleton dibuja DOS cards apiladas de "progreso". La vista real
   (Clase B, caso dominante) es UNA card "Clases Prácticas" = cabecera con % + barra de
   progreso + grilla de ~12 tarjetas de clase (`auto-fit minmax(200px,1fr)`).
3. **Columna 3 (Estado Financiero):** al skeleton le falta el botón "Ver todo el historial"
   anclado abajo (`mt-auto`) que sí tiene la card real.

## Cambios
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts`
  (solo el bloque `@if (facade.isLoading())` del `template`).
  - Col 1: agregar divisor + `grid grid-cols-2 gap-2` de 6 `app-skeleton-block` (rect ~36px) +
    2 rect full-width, replicando la zona de acciones.
  - Col 2: reemplazar el `@for (_ of [1,2])` por UNA `bento-card` con cabecera (título + KPI %),
    barra de progreso (rect rounded-full) y grilla de **12 tiles** (`rect` ~64px, mismo
    `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))` que la real). 12 y no 6
    porque el caso dominante es la matrícula completa de 12 clases; solo las de refuerzo
    traen 6.
  - Col 3: agregar `app-skeleton-block` rect full-width (~40px) con `mt-auto` como placeholder
    del botón "Ver todo el historial".
- Sin cambios de lógica, contratos ni tests. Verificación visual con `/verify`
  (comparar skeleton vs. vista cargada, sin salto de layout perceptible).
