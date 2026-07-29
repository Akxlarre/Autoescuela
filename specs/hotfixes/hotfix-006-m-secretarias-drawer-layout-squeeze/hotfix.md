# hotfix-006-m — Layout de Secretarias se desordena al abrir un drawer

## Problema
En "Gestión de Secretarias", al abrir cualquier drawer (Nueva/Editar/Ver
Secretaria) el `<main>` se angosta (el drawer ocupa espacio a la derecha,
compartiendo el mismo contenedor flex). La página usa dos celdas bento
separadas: `bento-wide` (Lista de Personal, `data-col-span="9"`) y
`bento-tall` (Panel de Control, `data-col-span="3"`), que solo se fuerzan a
9/3 columnas en el breakpoint `lg` del container query `layoutmain`. Por
debajo de `lg` (que es exactamente el rango al que cae el `<main>` angostado
con el drawer abierto), las clases de proporción por defecto (`bento-wide`
sm/md=4, `bento-tall` sm/md=2) las siguen mostrando lado a lado pero muy
comprimidas — el Panel de Control queda con un ancho mínimo y su contenido
(heading uppercase, card "Rol Secretaria", lista de permisos) se desordena y
se ve superpuesto.

## Causa raíz
Falta un override de `data-col-span-md` que fuerce el stack vertical (ambas
celdas a ancho completo) por debajo de `lg`, tal como sí ocurre implícitamente
en la vista de Instructores — esa vista usa una única celda `bento-banner`
full-width (sin split lateral), por lo que nunca se comprime al abrir un
drawer.

## Cambio
`admin-secretarias.component.ts` — agregar `data-col-span-md="8"` a las 4
apariciones de las celdas `bento-wide`/`bento-tall` (loading skeleton +
contenido real), de modo que por debajo de `lg` ambas celdas ocupen el 100%
del ancho disponible (stack vertical: lista arriba, panel abajo) en vez de
compartir una fila comprimida. El split 9/3 lado a lado se mantiene igual a
partir de `lg`.

## Acceptance Criteria
- [x] Con el `<main>` angostado por el drawer abierto (rango de ancho
      equivalente al breakpoint `md`, 768–1023px), la Lista de Personal y el
      Panel de Control se apilan verticalmente en vez de compartir fila
      comprimidos.
- [x] A partir de `lg` (≥1024px de contenedor) el layout 9/3 lado a lado se
      mantiene sin cambios.
