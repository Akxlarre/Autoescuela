# Fix: Cuadratura Diaria — Egresos no responde al drawer abierto como Ingresos
> id: fix-231-m-cuadratura-egresos-drawer-abierto
> refs: fix-230-m
> status: done
> closed: 2026-08-31
> created: 2026-08-31

## Root Cause
En `cuadratura-content.component.ts`, el panel de "Registro de Ingresos" cambia a vista
mobile-card y oculta su header de columnas desktop cuando `isDrawerOpen()` es `true`
(`[class.!hidden]="isDrawerOpen()"` en el header de columnas y la tabla desktop, más
`[class.!flex]="isDrawerOpen()"` en el bloque de cards). El panel de "Registro de Egresos"
nunca implementó ese mismo patrón: su header de columnas (`Motivo / Método / Monto`) y su
grid de filas se muestran siempre igual, sin importar si el drawer de Arqueo y Cierre está
abierto y `main` quedó angostado por debajo de los ~1024px que necesita esa tabla de 4
columnas. Resultado: con el drawer abierto, Ingresos se adapta correctamente pero Egresos
queda comprimido en un formato de escritorio dentro de un contenedor angosto — la asimetría
visual reportada por el dueño en el demo del 2026-08-31.

## ACs Afectados
Ninguno — fix autónomo (hallado en revisión visual de fix-230-m, no en una spec formal).
- AC-1: Con el drawer de Arqueo/Cierre abierto, el panel de Egresos oculta su header de
  columnas desktop y muestra sus filas en formato card, igual que Ingresos.
- AC-2: Sin drawer abierto y en viewport angosto (mobile), Egresos sigue mostrando el mismo
  fallback de card (comportamiento ya existente para Ingresos, replicado para Egresos).

## Cambio
- **Archivo:** `src/app/shared/components/cuadratura-content/cuadratura-content.component.ts`
- **Qué cambia:** el bloque de "Registro de Egresos" gana un header de columnas condicional
  (`[class.!hidden]="isDrawerOpen()"`) y una vista mobile-card equivalente a la de Ingresos,
  activada por `isDrawerOpen()` o por ancho de contenedor angosto — mismo mecanismo que ya
  usa Ingresos, sin inventar un patrón nuevo.

## Test de Regresión
- Verificación visual con Playwright (`/verify`): abrir Arqueo y Cierre con datos sembrados
  de Ingresos y Egresos, confirmar que ambos paneles muestran el mismo formato (cards, sin
  header de columnas desktop) mientras el drawer está abierto.
