import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LayoutService } from './layout.service';

/** Mock de ResizeObserver que captura el callback para dispararlo a mano. */
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;

  constructor(readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }

  observe(el: Element): void {
    this.observed.push(el);
  }

  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  /** Simula un resize del elemento observado. */
  emitWidth(width: number): void {
    this.callback(
      [{ contentRect: { width } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

describe('LayoutService', () => {
  let service: LayoutService;

  beforeEach(() => {
    MockResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    TestBed.configureTestingModule({});
    service = TestBed.inject(LayoutService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with sidebar closed', () => {
    expect(service.sidebarOpen()).toBe(false);
  });

  it('openSidebar() should set sidebarOpen to true', () => {
    service.openSidebar();
    expect(service.sidebarOpen()).toBe(true);
  });

  it('closeSidebar() should set sidebarOpen to false', () => {
    service.openSidebar();
    service.closeSidebar();
    expect(service.sidebarOpen()).toBe(false);
  });

  it('toggleSidebar() should flip the state each call', () => {
    service.toggleSidebar();
    expect(service.sidebarOpen()).toBe(true);
    service.toggleSidebar();
    expect(service.sidebarOpen()).toBe(false);
  });

  describe('tier por contenedor (spec 0028)', () => {
    it("tier() es 'desktop' por defecto, antes de observar", () => {
      expect(service.mainWidth()).toBeNull();
      expect(service.tier()).toBe('desktop');
    });

    it('observeMain() actualiza mainWidth/tier al recibir resize', () => {
      const el = document.createElement('main');
      service.observeMain(el);

      const observer = MockResizeObserver.instances[0];
      expect(observer.observed).toContain(el);

      observer.emitWidth(1440);
      expect(service.tier()).toBe('desktop');

      observer.emitWidth(800);
      expect(service.tier()).toBe('tablet');

      observer.emitWidth(390);
      expect(service.tier()).toBe('mobile');
      expect(service.mainWidth()).toBe(390);
    });

    it('el cleanup retornado desconecta el observer', () => {
      const el = document.createElement('main');
      const cleanup = service.observeMain(el);

      const observer = MockResizeObserver.instances[0];
      cleanup();
      expect(observer.disconnected).toBe(true);
    });

    it('sin ResizeObserver (SSR) retorna cleanup no-op y mantiene desktop', () => {
      vi.stubGlobal('ResizeObserver', undefined);
      const el = document.createElement('main');
      const cleanup = service.observeMain(el);

      expect(() => cleanup()).not.toThrow();
      expect(service.tier()).toBe('desktop');
    });
  });
});
