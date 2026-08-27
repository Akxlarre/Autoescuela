# Fix: Botón "Cerrar Caja" no está disponible dentro del drawer de Arqueo y Cierre

> id: fix-225-m-boton-cerrar-caja-dentro-drawer-arqueo
> refs: —
> status: done
> closed: 2026-08-27
> created: 2026-08-27

## Root Cause

`ArqueoCierreDrawerComponent` (spec 0004-i) solo tiene un botón "Listo" en su footer, que
cierra el drawer sin ejecutar ninguna acción. La única forma de cerrar la caja es el botón
"Cerrar Caja" del Hero de `cuadratura-content`, fuera del drawer — documentado a propósito en
el comentario de cabecera del componente ("El botón 'Cerrar Caja' NO vive acá — se movió al
Hero"), pero esa decisión solo justifica sacar el *contador de billetes* del Hero (evitaba
romper el layout de esa columna de ancho fijo), no por qué "Cerrar Caja" quedó fuera del drawer.

Hallazgo de UX durante UAT manual (Paquete 4, ítem "Cierre de caja del día"): tras revisar la
diferencia del arqueo y escribir la justificación dentro del drawer, el usuario debe cerrar el
drawer y buscar el botón en el Hero para confirmar — un paso extra justo en el momento en que
más sentido tiene poder confirmar sin salir del flujo.

## ACs Afectados

Ninguno — fix autónomo de UX, no relacionado a la lógica de cálculo/validación del cierre
(ya verificada manualmente en el UAT, ítem que se cierra aparte).

## Cambio

- **`arqueo-cierre-drawer.component.ts`**: agrega un segundo botón "Cerrar Caja" en el footer
  del drawer, junto a "Listo". Reutiliza `facade.puedeCerrarCaja()` para habilitar/deshabilitar
  (mismo guard que ya usa el botón del Hero) y `facade.isSaving()` para el estado de carga.
  Al confirmar, pide confirmación vía `ConfirmModalService` (mismo modal y mensaje que usan
  `admin-contabilidad-cuadratura.component.ts` y `secretaria-contabilidad-cuadratura.component.ts`
  en su `onCerrarCaja()`), llama `facade.cerrarCaja()` y cierra el drawer si tuvo éxito.
  El botón del Hero se mantiene sin cambios (acceso rápido sin abrir el drawer).

## Test de Regresión

Cambio de UI en un componente ya cubierto por `cuadratura.facade.spec.ts` (lógica de
`puedeCerrarCaja`/`cerrarCaja` sin cambios). No se agrega spec nuevo — no hay lógica de
decisión nueva en el componente, solo un segundo punto de entrada al mismo método del Facade.
Verificado manualmente con `/verify` tras la implementación.
