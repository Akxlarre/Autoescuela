import { TestBed } from '@angular/core/testing';
import { LayoutDrawerService } from './layout-drawer.service';
import { Component } from '@angular/core';

@Component({ template: '' })
class DummyComponent {}

describe('LayoutDrawerService', () => {
  let service: LayoutDrawerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LayoutDrawerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default state', () => {
    expect(service.isOpen()).toBe(false);
    expect(service.component()).toBeNull();
    expect(service.title()).toBe('');
    expect(service.icon()).toBeUndefined();
  });

  it('should update state on open()', () => {
    service.open(DummyComponent, 'Test Title', 'test-icon');
    expect(service.isOpen()).toBe(true);
    expect(service.component()).toBe(DummyComponent);
    expect(service.title()).toBe('Test Title');
    expect(service.icon()).toBe('test-icon');
  });

  it('should update state on close(), keeping the component for animation', () => {
    service.open(DummyComponent, 'Test Title');
    service.close();
    expect(service.isOpen()).toBe(false);
    expect(service.component()).toBe(DummyComponent); // Ensure not cleared yet
  });

  it('should clean the state on clear()', () => {
    service.open(DummyComponent, 'Test Title');
    service.clear();
    expect(service.component()).toBeNull();
    expect(service.title()).toBe('');
    expect(service.icon()).toBeUndefined();
  });

  it('should update the badge on setBadge()', () => {
    service.open(DummyComponent, 'Test Title');
    service.setBadge('Paso 2 de 6');
    expect(service.badge()).toBe('Paso 2 de 6');
  });

  it('should clear the badge when setBadge(null) is called', () => {
    service.open(DummyComponent, 'Test Title');
    service.setBadge('Paso 2 de 6');
    service.setBadge(null);
    expect(service.badge()).toBeNull();
  });

  it('should default badge() to null when unset', () => {
    expect(service.badge()).toBeNull();
  });

  describe('cierre con confirmación (fix-310-m)', () => {
    it('sin pregunta registrada, requestClose() cierra de inmediato', async () => {
      service.open(DummyComponent, 'Test Title');

      await service.requestClose();

      expect(service.isOpen()).toBe(false);
    });

    it('si la pregunta responde que no, el panel sigue abierto', async () => {
      service.open(DummyComponent, 'Test Title');
      const guard = vi.fn().mockResolvedValue(false);
      service.setCloseGuard(guard);

      await service.requestClose();

      expect(guard).toHaveBeenCalledTimes(1);
      expect(service.isOpen()).toBe(true);
    });

    it('si la pregunta responde que sí, el panel se cierra', async () => {
      service.open(DummyComponent, 'Test Title');
      service.setCloseGuard(() => true);

      await service.requestClose();

      expect(service.isOpen()).toBe(false);
    });

    it('close() cierra sin preguntar', () => {
      service.open(DummyComponent, 'Test Title');
      const guard = vi.fn().mockResolvedValue(false);
      service.setCloseGuard(guard);

      service.close();

      expect(guard).not.toHaveBeenCalled();
      expect(service.isOpen()).toBe(false);
    });

    it('abrir otro panel descarta la pregunta del anterior', async () => {
      service.open(DummyComponent, 'Primero');
      const guard = vi.fn().mockResolvedValue(false);
      service.setCloseGuard(guard);

      service.open(DummyComponent, 'Segundo');
      await service.requestClose();

      expect(guard).not.toHaveBeenCalled();
      expect(service.isOpen()).toBe(false);
    });

    it('dos pedidos de cierre seguidos preguntan una sola vez', async () => {
      service.open(DummyComponent, 'Test Title');
      let answer!: (value: boolean) => void;
      const guard = vi.fn().mockReturnValue(new Promise<boolean>((resolve) => (answer = resolve)));
      service.setCloseGuard(guard);

      const first = service.requestClose();
      const second = service.requestClose();
      answer(false);
      await Promise.all([first, second]);

      expect(guard).toHaveBeenCalledTimes(1);
      expect(service.isOpen()).toBe(true);
    });
  });
});
