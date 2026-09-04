# Fix: Botón "Cerrar Caja" duplicado en el Hero de Cuadratura Diaria

> id: fix-238-m-cerrar-caja-hero-redundante
> refs: fix-225-m-boton-cerrar-caja-dentro-drawer-arqueo, spec 0004-i-app-like-cuadratura
> status: done
> closed: 2026-09-04
> created: 2026-09-04

## Root Cause

Desde fix-225-m, "Cerrar Caja" existe en dos lugares: como acción del Hero de
`cuadratura-content` (atajo directo, pensado para cuando `realizarArqueo` está
desactivado) y como botón del footer del drawer "Arqueo y Cierre" (agregado para no
tener que salir del drawer tras revisar el arqueo). El dueño, viendo la UI, marcó esto
como confuso: dos botones para la misma acción en la misma vista, y el nombre "Arqueo y
Cierre" ya implica el cierre — no queda claro por qué hace falta un tercer botón aparte.

Se decide dejar un único punto de entrada al cierre: el botón dentro del drawer. Esto
fuerza a que el usuario siempre pase por la pantalla de arqueo (aunque esté desactivado)
antes de cerrar, eliminando la ambigüedad de cuál botón usar.

## ACs Afectados

Ninguno — fix autónomo de UX, no toca lógica de cálculo/validación del cierre (vive en
`CuadraturaFacade`, sin cambios).

## Cambio

- **`cuadratura-content.component.ts`**: elimina la acción `cerrar-caja` del Hero
  (`heroActions`, `onHeroAction`, `cerrarCajaLabel`) y el output `cerrarCaja`. Elimina los
  inputs que solo alimentaban esa acción (`realizarArqueo`, `diferenciaArqueo`,
  `notasArqueo`, `puedeCerrarCaja`, `isSaving`) por quedar sin uso. Promueve la acción
  `ver-arqueo` ("Arqueo y Cierre") a `primary: true` — pasa a ser el único CTA de marca del
  Hero, destacándola como el camino obligado para cerrar caja.
- **`admin-contabilidad-cuadratura.component.ts`** / **`secretaria-contabilidad-cuadratura.component.ts`**:
  quitan el binding `(cerrarCaja)="onCerrarCaja()"` y el método `onCerrarCaja()` (quedan
  sin llamador — `ArqueoCierreDrawerComponent.onCerrarCaja()` ya confirma y cierra por su
  cuenta, sin pasar por el Smart wrapper).

## Test de Regresión

Cambio de UI en un componente Dumb sin `computed()` de negocio nuevo — la lógica de
`puedeCerrarCaja`/`cerrarCaja` no se toca, sigue cubierta por `cuadratura.facade.spec.ts`.
No se agrega spec nueva. Verificado manualmente con `/verify`: el Hero muestra un solo
botón de cierre ("Arqueo y Cierre", celeste/primario) y el flujo de cierre completo
(con y sin arqueo activo) sigue funcionando desde el drawer.
