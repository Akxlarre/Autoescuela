import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LucideAngularModule, Settings, Layout } from 'lucide-angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TabsComponent, type TabOption } from './tabs.component';

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

const TABS: TabOption[] = [
  { id: 'general', label: 'General & Redes', shortLabel: 'General', icon: 'settings' },
  { id: 'hero', label: 'Sección Hero', shortLabel: 'Hero', icon: 'layout' },
];

@Component({
  standalone: true,
  imports: [TabsComponent],
  template: `
    <app-tabs
      [tabs]="tabs"
      [activeId]="activeId"
      variant="line"
      (activeIdChange)="onChange($event)"
    />
  `,
})
class HostComponent {
  tabs = TABS;
  activeId = 'general';
  received: string | null = null;
  onChange(id: string): void {
    this.received = id;
  }
}

// fix-127-m — TabsComponent variant="line" replica el patrón de tiers de
// libro-de-clases-subnav.component.ts (fix-052-m). La decisión de tier
// (full/short/icon/select) ya está 100% cubierta en subnav-tier.utils.spec.ts
// (función pura, reutilizada tal cual) — este spec queda documentado y listo
// para des-skipearse cuando la infra de TestBed soporte templates.
// TODO: Component template tests require @analogjs/vite-plugin-angular for compilation.
// Adding that plugin to vitest.config.ts breaks TestBed for all facade/service tests.
describe.skip('TabsComponent (variant="line")', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    MockResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    await TestBed.configureTestingModule({
      imports: [HostComponent, LucideAngularModule.pick({ Settings, Layout })],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('clickear un tab emite activeIdChange con el id correcto', () => {
    const tabs = fixture.debugElement.queryAll(By.css('[role="tab"]'));
    tabs[1].nativeElement.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.received).toBe('hero');
  });

  it('degrada a "select" cuando ningún tier cabe en el ancho disponible', () => {
    const tabsComponent = fixture.debugElement.query(By.directive(TabsComponent))
      .componentInstance as TabsComponent;

    const hostEl: HTMLElement = (tabsComponent as any).lineHost().nativeElement;
    const measures = ['lineFullMeasure', 'lineShortMeasure', 'lineIconMeasure'] as const;
    Object.defineProperty(hostEl, 'clientWidth', { value: 10, configurable: true });
    for (const key of measures) {
      Object.defineProperty((tabsComponent as any)[key]().nativeElement, 'scrollWidth', {
        value: 500,
        configurable: true,
      });
    }

    MockResizeObserver.instances[0].emit();
    fixture.detectChanges();

    expect(tabsComponent.lineTier()).toBe('select');
    expect(fixture.debugElement.query(By.css('p-select'))).toBeTruthy();
    expect(fixture.debugElement.queryAll(By.css('[role="tab"]')).length).toBe(0);
  });
});
