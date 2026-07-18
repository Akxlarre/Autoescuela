# Fix: Skeletons de Asistencia B no espejan el layout real cargado
> id: fix-046-b-skeletons-asistencia-fieles-al-layout
> refs: 0030-asistencia-b-layout-dual, 0031-ciclos-teoricos-fill-screen
> status: done
> closed: 2026-07-16
> created: 2026-07-16

## Root Cause
Los estados de carga de la vista Asistencia B no reproducen la forma del contenido real,
provocando reflow/CLS al resolver los datos (medido con el skeleton congelado vía
intercepción de red):

1. **Prácticas — rail de alertas ausente en carga:** el `<aside>` de alertas está tras
   `@if (!isLoading() && alertas().length > 0)`, así que durante la carga NO existe. La
   tabla se pinta a **904px (full width)** y al llegar los datos el rail (`w-80`) aparece y
   la tabla **salta a 568px** (−336px de reflow horizontal).
2. **Ciclos — skeleton bare:** el `@if (isLoading())` de `ciclos-teoricos-content` muestra
   **3 barras desnudas** (sin cards ni columnas), nada que ver con el layout real de 2
   columnas (`card` Clases `flex-1` + `card` Alumnos `w-96`).
3. **Prácticas — tabla no parece tabla:** el skeleton de la tabla son 5 barras genéricas
   con gap, sin header (thead) ni estructura de columnas.

(El skeleton del `section-hero` también difiere ~9px, pero es un componente COMPARTIDO por
~decenas de páginas → queda FUERA de este fix por decisión del owner.)

## ACs Afectados
Ninguno funcional — mejora de fidelidad visual de estados de carga (CLS). No altera
contratos, datos ni ACs de las specs 0030/0031.

## Cambio
- **Archivo 1:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
  - Rama `@if (isLoading())` para el rail de alertas: renderiza un `<aside>` skeleton con
    las mismas clases/dimensiones (`w-80`/`shrink-0` en desktop) → la tabla mantiene su
    ancho (568px) durante y después de la carga.
  - Skeleton de la tabla: header (thead) + filas con celdas tipo columna en vez de barras.
- **Archivo 2:** `src/app/shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component.ts`
  - Reemplaza el `@if (isLoading())` de 3 barras por un skeleton de 2 columnas que espeja
    el shell real (card Clases `flex-1 min-w-0` + card Alumnos `w-96 shrink-0`, switch por
    `isDesktop()`), con skeletons de clase-card y filas de roster.

Único origen de skeletons: `<app-skeleton-block>` (ya importado en ambos). Cambios
template-only, sin nueva lógica ni imports.

## Test de Regresión
Cambio puramente visual (markup de skeleton). Verificación:
- `npm run test:ci` verde (specs existentes de ambos componentes no rompen).
- `ng build` compila.
- `/verify` (Playwright) con el skeleton congelado (intercepción de red): en Prácticas el
  ancho de la tabla NO cambia entre carga y datos (rail presente en ambos); en Ciclos el
  skeleton muestra 2 columnas con cards; ambos en light+dark, sin reflow horizontal.
