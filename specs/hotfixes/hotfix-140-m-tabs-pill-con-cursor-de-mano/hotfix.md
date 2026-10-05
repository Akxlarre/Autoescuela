# Hotfix: Tabs tipo pill con cursor de mano
> id: hotfix-140-m-tabs-pill-con-cursor-de-mano
> refs: ASG-i-024
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Problema
En la ficha del alumno, los botones del selector de matrícula ("Clase B · #0083", "Clase B ·
#0082") no cambian el cursor a la mano al pasar el mouse. Son `app-tabs` con `variant="pill"`, y de
las tres variantes del componente esa es la única cuyo botón no lleva `cursor-pointer`. Reportado
por Matías con una captura.

## Cambios
- **Archivo:** `src/app/shared/components/tabs/tabs.component.ts` — `cursor-pointer` en el botón de
  la variante pill, igual que en las otras dos.

Afecta a todos los `app-tabs` con `variant="pill"` de la app, no solo al selector de matrícula.

## Verificación
Comprobado en navegador en la ficha del alumno de las matrículas 0083 y 0082: el cursor calculado
de los dos botones es `pointer` (antes `default`).
