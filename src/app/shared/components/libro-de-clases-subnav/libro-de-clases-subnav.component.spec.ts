import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LucideAngularModule, FileText, Users } from 'lucide-angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibroClasesSubnavSection } from '@core/models/ui/libro-clases-subnav.model';
import { LibroDeClasesSubnavComponent } from './libro-de-clases-subnav.component';

/** Mock de ResizeObserver que captura el callback para dispararlo a mano. */
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  constructor(readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  emit(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

const SECTIONS: LibroClasesSubnavSection[] = [
  { id: 'cabecera', label: 'Cabecera', shortLabel: 'Cab.', icon: 'file-text' },
  {
    id: 'profesores',
    label: 'Profesores por Módulo',
    shortLabel: 'Prof.',
    icon: 'users',
    meta: '6',
  },
];

@Component({
  standalone: true,
  imports: [LibroDeClasesSubnavComponent],
  template: `
    <app-libro-de-clases-subnav
      [sections]="sections"
      [activeId]="activeId"
      (sectionChange)="onChange($event)"
    />
  `,
})
class HostComponent {
  sections = SECTIONS;
  activeId = 'cabecera';
  received: string | null = null;
  onChange(id: string): void {
    this.received = id;
  }
}

// TODO: Component template tests require @analogjs/vite-plugin-angular for compilation.
// Adding that plugin to vitest.config.ts breaks TestBed for all facade/service tests.
// Track resolution in: fix vitest.config.ts to support both Angular plugin + TestBed.
// La decisión de tier (full/short/icon/select) ya está 100% cubierta en
// subnav-tier.utils.spec.ts (función pura) — este spec queda documentado y
// listo para des-skipearse cuando la infra de TestBed soporte templates.
describe.skip('LibroDeClasesSubnavComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    MockResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    await TestBed.configureTestingModule({
      imports: [HostComponent, LucideAngularModule.pick({ FileText, Users })],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  // fix-052-m — AC2, AC4
  it('AC2/AC4 — renderiza un ítem por sección con data-llm-nav y title', () => {
    const items = fixture.debugElement.queryAll(By.css('[data-llm-nav]'));
    expect(items.length).toBe(2);
    expect(items[0].nativeElement.getAttribute('data-llm-nav')).toBe('libro-clases-cabecera');
    expect(items[1].nativeElement.getAttribute('title')).toBe('Profesores por Módulo');
  });

  // fix-052-m — AC2
  it('AC2 — clickear un ítem emite sectionChange con el id correcto', () => {
    const items = fixture.debugElement.queryAll(By.css('[data-llm-nav]'));
    items[1].nativeElement.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.received).toBe('profesores');
  });

  // fix-052-m — AC3
  it('AC3 — degrada a "select" cuando ningún tier cabe en el ancho disponible', () => {
    const subnav = fixture.debugElement.query(By.directive(LibroDeClasesSubnavComponent))
      .componentInstance as LibroDeClasesSubnavComponent;

    const hostEl: HTMLElement = (subnav as any).hostEl().nativeElement;
    const measures = ['fullMeasure', 'shortMeasure', 'iconMeasure'] as const;
    Object.defineProperty(hostEl, 'clientWidth', { value: 10, configurable: true });
    for (const key of measures) {
      Object.defineProperty((subnav as any)[key]().nativeElement, 'scrollWidth', {
        value: 500,
        configurable: true,
      });
    }

    MockResizeObserver.instances[0].emit();
    fixture.detectChanges();

    expect(subnav.tier()).toBe('select');
    expect(fixture.debugElement.query(By.css('p-select'))).toBeTruthy();
    expect(fixture.debugElement.queryAll(By.css('[role="tab"]')).length).toBe(0);
  });
});
