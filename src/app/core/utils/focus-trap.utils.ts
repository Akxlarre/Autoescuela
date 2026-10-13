/**
 * Foco del teclado dentro de un modal (fix-390-m). Funciones puras sobre el DOM: las usa
 * `ModalFocusDirective`.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[tabindex]',
].join(',');

/** Elementos que reciben foco con Tab dentro de `root`, en el orden del HTML. */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      !el.hasAttribute('disabled') &&
      el.getAttribute('tabindex') !== '-1' &&
      el.closest('[hidden]') === null,
  );
}

/**
 * Quién toma el foco al abrirse el modal: el elemento marcado con `data-modal-autofocus`, si
 * no el primero que recibe foco, y si no hay ninguno el propio contenedor.
 */
export function initialFocusTarget(root: HTMLElement): HTMLElement {
  const focusables = focusableWithin(root);
  return focusables.find((el) => el.hasAttribute('data-modal-autofocus')) ?? focusables[0] ?? root;
}

/**
 * A dónde debe saltar el foco al pulsar Tab para no salir del modal. `null` = el salto natural
 * del navegador ya queda adentro.
 */
export function trapTabTarget(
  root: HTMLElement,
  active: Element | null,
  shiftKey: boolean,
): HTMLElement | null {
  const focusables = focusableWithin(root);
  if (focusables.length === 0) return root;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const index = active instanceof HTMLElement ? focusables.indexOf(active) : -1;

  if (index === -1) return shiftKey ? last : first;
  if (shiftKey && index === 0) return last;
  if (!shiftKey && index === focusables.length - 1) return first;
  return null;
}
