import { describe, expect, it } from 'vitest';
import { focusableWithin, initialFocusTarget, trapTabTarget } from './focus-trap.utils';

function build(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

const ids = (els: HTMLElement[]) => els.map((e) => e.id);

describe('focusableWithin()', () => {
  it('lista botones, enlaces y campos en el orden del HTML', () => {
    const root = build(`
      <button id="a">A</button>
      <a id="b" href="#">B</a>
      <textarea id="c"></textarea>
      <input id="d" />
    `);
    expect(ids(focusableWithin(root))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('descarta lo deshabilitado, lo oculto y lo que se sacó del orden de tabulación', () => {
    const root = build(`
      <button id="a" disabled>A</button>
      <button id="b" tabindex="-1">B</button>
      <div hidden><button id="c">C</button></div>
      <input id="d" type="hidden" />
      <button id="e">E</button>
    `);
    expect(ids(focusableWithin(root))).toEqual(['e']);
  });
});

describe('initialFocusTarget()', () => {
  it('prefiere el elemento marcado para recibir el foco', () => {
    const root = build(`
      <button id="cerrar">X</button>
      <textarea id="motivo" data-modal-autofocus></textarea>
    `);
    expect(initialFocusTarget(root).id).toBe('motivo');
  });

  it('sin marca, toma el primer elemento que recibe foco', () => {
    const root = build(
      '<p>Texto</p><button id="cancelar">Cancelar</button><button id="ok">OK</button>',
    );
    expect(initialFocusTarget(root).id).toBe('cancelar');
  });

  it('si la marca está en un elemento deshabilitado, cae en el primero disponible', () => {
    const root = build(
      '<button id="a" data-modal-autofocus disabled>A</button><button id="b">B</button>',
    );
    expect(initialFocusTarget(root).id).toBe('b');
  });

  it('sin nada que reciba foco, devuelve el contenedor', () => {
    const root = build('<p>Solo texto</p>');
    expect(initialFocusTarget(root)).toBe(root);
  });
});

describe('trapTabTarget()', () => {
  const html = '<button id="a">A</button><button id="b">B</button><button id="c">C</button>';

  it('en el medio deja que el navegador avance solo', () => {
    const root = build(html);
    const b = root.querySelector<HTMLElement>('#b')!;
    expect(trapTabTarget(root, b, false)).toBeNull();
    expect(trapTabTarget(root, b, true)).toBeNull();
  });

  it('Tab en el último vuelve al primero', () => {
    const root = build(html);
    expect(trapTabTarget(root, root.querySelector('#c'), false)?.id).toBe('a');
  });

  it('Shift+Tab en el primero va al último', () => {
    const root = build(html);
    expect(trapTabTarget(root, root.querySelector('#a'), true)?.id).toBe('c');
  });

  it('con el foco fuera, o en el contenedor, lo trae adentro', () => {
    const root = build(html);
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    expect(trapTabTarget(root, outside, false)?.id).toBe('a');
    expect(trapTabTarget(root, root, true)?.id).toBe('c');
    expect(trapTabTarget(root, null, false)?.id).toBe('a');
  });

  it('sin nada que reciba foco, se queda en el contenedor', () => {
    const root = build('<p>Solo texto</p>');
    expect(trapTabTarget(root, root, false)).toBe(root);
  });
});
