# Fix: El panel lateral se adapta al achicar la ventana
> id: fix-317-m-el-panel-lateral-se-adapta-al-achicar-la-ventana
> refs: ASG-i-024
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Root Cause
El panel lateral de la app (el drawer del layout) decide su tamaño una sola vez, al abrirse: en escritorio toma el 45 % del ancho de la ventana (720 px a 1600) y en móvil ocupa la pantalla completa. Nadie vuelve a calcularlo si la ventana cambia de tamaño con el panel abierto. Al achicar la ventana, el panel se queda en sus 720 px fijos: en una ventana angosta no cabe, el contenido de fondo desaparece y la X para cerrarlo queda fuera de la pantalla. Abierto directamente en una ventana angosta se ve bien. Anotado en `fix-264-m` con el panel de Nueva Matrícula; afecta a cualquier panel.

## ACs Afectados
- Con un panel abierto, al cambiar el tamaño de la ventana el panel queda como si se hubiera abierto en ese tamaño: 45 % del ancho en escritorio, pantalla completa bajo 768 px, y de vuelta.
- La X de cerrar queda siempre a la vista.
- Abrir y cerrar un panel sin cambiar el tamaño de la ventana se comporta igual que antes.

## Cambio
- **Archivo:** el servicio de animaciones GSAP — `syncLayoutDrawerToViewport()` aplica, sin animación, el modo y el ancho que corresponden al tamaño actual; el cálculo del ancho de escritorio pasa a una función pura compartida con la apertura.
- **Archivo:** el componente del panel del layout — escucha el cambio de tamaño de la ventana mientras el panel está abierto.

## Test de Regresión
- Spec del util del ancho del panel (4 tests) ✓
- Test de navegador en la suite de la lista de alumnos, "fix-317-m · hotfix-143-m" ✓: con el
  panel de Nueva Matrícula abierto a 1600 px mide 720; al pasar la ventana a 600 px ocupa los 600
  y la X sigue entera a la vista; al volver a 1400 px mide 630 y la lista vuelve a verse al lado.

## Verificación
2026-10-05: tests unitarios del util, del panel y del servicio de animaciones en verde (32); el
test de navegador pasa. No se corrió ese test contra el código sin el arreglo; el comportamiento
anterior (el panel se queda en 720 px) es el que se había medido en `fix-264-m`.

Aplica a todos los paneles laterales de la app, no solo al de Nueva Matrícula. `indices/UTILS.md`
actualizado.
