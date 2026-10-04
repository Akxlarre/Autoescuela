import type { WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ExportMenuComponent, type ExportFormat } from './export-menu.component';

/** Lo que el test necesita de la parte protegida del componente. */
interface ExportMenuInternals {
  open: WritableSignal<boolean>;
  closeIfOutside(event: Event): void;
  choose(format: ExportFormat): void;
}

/**
 * No se renderiza la plantilla: en esta infra (JIT) los signal inputs de los hijos no se enlazan.
 * Que el clic y Escape lleguen desde el documento lo cubre e2e/alumnos-b-lista.spec.ts (K01).
 */
describe('ExportMenuComponent — cerrar el menú (fix-286-m)', () => {
  let fixture: ComponentFixture<ExportMenuComponent>;
  let menu: ExportMenuInternals;

  const clickOn = (target: Node): Event => {
    const event = new MouseEvent('click');
    Object.defineProperty(event, 'target', { value: target });
    return event;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ExportMenuComponent] });
    fixture = TestBed.createComponent(ExportMenuComponent);
    menu = fixture.componentInstance as unknown as ExportMenuInternals;
  });

  it('un clic fuera del componente cierra el menú abierto', () => {
    menu.open.set(true);

    menu.closeIfOutside(clickOn(document.body));

    expect(menu.open()).toBe(false);
  });

  it('un clic dentro del componente no lo cierra: lo resuelve el botón o la opción', () => {
    const inside = document.createElement('button');
    (fixture.nativeElement as HTMLElement).appendChild(inside);
    menu.open.set(true);

    menu.closeIfOutside(clickOn(inside));

    expect(menu.open()).toBe(true);
  });

  it('con el menú cerrado un clic fuera no hace nada', () => {
    menu.closeIfOutside(clickOn(document.body));

    expect(menu.open()).toBe(false);
  });

  it('elegir una opción avisa el formato y cierra el menú', () => {
    const chosen: ExportFormat[] = [];
    fixture.componentInstance.exportRequested.subscribe((f) => chosen.push(f));
    menu.open.set(true);

    menu.choose('pdf');

    expect(chosen).toEqual(['pdf']);
    expect(menu.open()).toBe(false);
  });
});
