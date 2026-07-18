# fix-045-m — Skeleton de "Registrar Pago" ocupa más espacio que el formulario real

## Contexto

El dueño reportó que el skeleton del drawer "Registrar Pago" (visible
brevemente ~350ms al abrir, patrón `DrawerContentLoaderComponent`) ocupa
notoriamente más alto que el formulario real una vez cargado — tanto en
el drawer abierto desde el Dashboard como desde la vista Pagos.

### Causa raíz

`RegistrarPagoDrawerComponent` (`registrar-pago-drawer.component.ts`) es
un único componente compartido por Dashboard, Pagos (admin/secretaria) y
Cuadratura. Su bloque `#skeletons` renderiza SIEMPRE, sin condición, dos
secciones que en el contenido real (`#content`) son mutuamente
excluyentes según `facade.enrollmentSeleccionado()`:

```html
<!-- #content real -->
@if (facade.enrollmentSeleccionado() === null) {
  <!-- selector ALUMNO (modo global) -->
}
@if (facade.enrollmentSeleccionado() !== null && ...) {
  <!-- alumno-info-card preseleccionado (modo contextual) -->
}
```

Pero `#skeletons` muestra el selector (label + rect 40px) **y además**
un `<app-skeleton-block variant="rect" height="56px" />` fijo que
representa la `alumno-info-card` — un bloque que en modo global (el más
común: botón "+ Registrar Pago" en Dashboard y en Pagos, sin alumno
preseleccionado) **no existe en el contenido real** hasta que el usuario
selecciona un alumno. Ese bloque de 56px + su gap (20px, `gap-5`) agrega
~76px de alto fantasma, que es aproximadamente la diferencia visual
reportada entre el skeleton y el formulario cargado.

En modo contextual ocurre lo inverso: el skeleton igual muestra el
selector ALUMNO (label+rect, ~60px) que en el contenido real NO se
renderiza (el `@if` lo oculta cuando hay alumno preseleccionado).

## Alcance

Único archivo: `registrar-pago-drawer.component.ts`.

Condicionar el bloque `#skeletons` con el mismo signal que ya usa
`#content` (`facade.enrollmentSeleccionado()`), para que el skeleton
represente el modo real que va a mostrar el formulario:

- Selector ALUMNO (label + rect) solo si `enrollmentSeleccionado() === null`.
- Placeholder de `alumno-info-card` (rect 56px) solo si
  `enrollmentSeleccionado() !== null`.

No se toca el resto de los bloques del skeleton (fecha, concepto, monto,
desglose, documento) ni la lógica de negocio/facade.

## Acceptance Criteria

- AC1: El skeleton NO muestra el placeholder de `alumno-info-card`
  (56px) cuando `facade.enrollmentSeleccionado() === null` (modo global).
- AC2: El skeleton NO muestra el placeholder del selector ALUMNO cuando
  `facade.enrollmentSeleccionado() !== null` (modo contextual).
- AC3: El alto total del skeleton en modo global queda alineado con el
  alto real del formulario en ese mismo modo (sin el bloque fantasma).
- AC4: No se modifica lógica de negocio ni facades; `npm run test:ci`
  sigue en verde.
