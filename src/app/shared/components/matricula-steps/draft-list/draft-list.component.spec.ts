import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { DraftListComponent } from './draft-list.component';

// fix-067-i (B4-1): la tarjeta era un role="button" con los botones Retomar/Descartar adentro
// (axe nested-interactive) y un clic en Retomar emitía resume dos veces (el botón y la tarjeta).
//
// El pipeline de Vitest no compila plantillas (ver vitest.config.ts): la lógica del clic se prueba
// sobre la clase, y que la tarjeta no sea un control se revisa en el código fuente. axe en el
// navegador confirma el resultado (fix.md § Verificación).
describe('DraftListComponent — tarjetas sin botones anidados (fix-067-i)', () => {
  function setup() {
    const component = TestBed.runInInjectionContext(() => new DraftListComponent());
    const resumed: number[] = [];
    component.resume.subscribe((id) => resumed.push(id));
    return { component, resumed };
  }

  function clickOn(target: HTMLElement): MouseEvent {
    return { target } as unknown as MouseEvent;
  }

  it('la tarjeta no es un control: sin role="button" ni tabindex', () => {
    const source = readFileSync(resolve(__dirname, 'draft-list.component.ts'), 'utf-8');
    // Hasta el `>` que cierra la etiqueta en su propia línea (los bindings pueden traer `>`).
    const card = source.match(/<div\s+class="draft-card"[\s\S]*?\n\s*>/)?.[0] ?? '';
    expect(card).not.toBe('');
    expect(card).not.toContain('role=');
    expect(card).not.toContain('tabindex');
  });

  it('un clic que viene de un botón de la tarjeta no la retoma (lo maneja el botón)', () => {
    const { component, resumed } = setup();
    const button = document.createElement('button');
    const icon = document.createElement('span');
    button.appendChild(icon);

    component.onCardClick(clickOn(icon), 77);

    expect(resumed).toEqual([]);
  });

  it('un clic en el cuerpo de la tarjeta la retoma', () => {
    const { component, resumed } = setup();
    const name = document.createElement('span');

    component.onCardClick(clickOn(name), 77);

    expect(resumed).toEqual([77]);
  });
});
