# ModalFocusDirective

Maneja el foco del teclado de un modal: lo lleva adentro al abrirlo, lo mantiene adentro mientras está abierto y lo devuelve al control que lo abrió al cerrarlo (fix-390-m).

## Propósito

Sin esto, al abrir un modal el foco queda en el botón de atrás: Tab recorre la pantalla tapada y los botones del modal no se alcanzan con el teclado.

## Selector

`[appModalFocus]`

## Uso

En el elemento con `role="dialog"`, que debe estar dentro de un `@if`: la directiva nace cuando el modal se abre y muere cuando se cierra.

```html
@if (modalOpen()) {
  <div role="dialog" aria-modal="true" aria-label="Justificar inasistencia" appModalFocus>
    <textarea data-modal-autofocus></textarea>
    <button (click)="close()">Cancelar</button>
    <button (click)="save()">Guardar</button>
  </div>
}
```

## Quién recibe el foco al abrir

1. El elemento marcado con `data-modal-autofocus`.
2. Si no hay, el primer elemento que recibe foco (en una confirmación, "Cancelar").
3. Si no hay ninguno, el propio contenedor.

## Qué NO hace

- No cierra el modal con Escape: eso sigue a cargo de cada modal.
- No bloquea el clic fuera del modal.

## Dependencias

- `core/utils/focus-trap.utils.ts` (funciones puras, con tests).
- Compatible con `appModalOverlay`: el foco se aplica después de que el modal se mueve de contenedor.
