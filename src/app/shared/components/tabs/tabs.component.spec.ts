import { Component, signal } from '@angular/core';
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

describe('TabsComponent (lógica WAI-ARIA e IDs)', () => {
  function setup(
    initialActive = 'perfil',
    tabs: TabOption[] = [
      { id: 'perfil', label: 'Mi Perfil', icon: 'user' },
      { id: 'config', label: 'Ajustes', icon: 'settings' },
      { id: 'seguridad', label: 'Seguridad', icon: 'shield' },
    ],
  ) {
    TestBed.configureTestingModule({});
    const component = TestBed.runInInjectionContext(() => new TabsComponent()) as any;
    component.tabs = signal(tabs);
    component.activeId = signal(initialActive);
    component.idPrefix = signal('ajustes');
    const emitted: string[] = [];
    component.activeIdChange = { emit: (id: string) => emitted.push(id) };
    return { component, emitted };
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('genera IDs y aria-controls cuando idPrefix está definido', () => {
    const { component } = setup();
    expect(component.tabElementId('perfil')).toBe('ajustes-tab-perfil');
    expect(component.tabPanelId('perfil')).toBe('ajustes-panel-perfil');

    component.idPrefix = signal(null);
    expect(component.tabElementId('perfil')).toBeNull();
    expect(component.tabPanelId('perfil')).toBeNull();
  });

  it('navega con ArrowRight, ArrowLeft, Home y End saltando tabs deshabilitadas', () => {
    const { component, emitted } = setup('perfil', [
      { id: 'perfil', label: 'Mi Perfil' },
      { id: 'bloqueada', label: 'Bloqueada', disabled: true },
      { id: 'config', label: 'Ajustes' },
      { id: 'seguridad', label: 'Seguridad' },
    ]);

    const keyEvent = (key: string) =>
      ({
        key,
        preventDefault: vi.fn(),
        currentTarget: null,
      }) as unknown as KeyboardEvent;

    component.onTabKeydown(keyEvent('ArrowRight'));
    expect(emitted.at(-1)).toBe('config');

    component.activeId.set('config');
    component.onTabKeydown(keyEvent('End'));
    expect(emitted.at(-1)).toBe('seguridad');

    component.activeId.set('perfil');
    component.onTabKeydown(keyEvent('ArrowLeft'));
    expect(emitted.at(-1)).toBe('seguridad');

    component.activeId.set('seguridad');
    component.onTabKeydown(keyEvent('Home'));
    expect(emitted.at(-1)).toBe('perfil');
  });
});
