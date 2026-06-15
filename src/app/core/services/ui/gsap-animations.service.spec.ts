import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { GsapAnimationsService } from './gsap-animations.service';

/**
 * Tests run with PLATFORM_ID='server' so shouldAnimate() returns false.
 * This covers the "no-op / fallback" paths without triggering real GSAP tweens.
 */
describe('GsapAnimationsService (server context)', () => {
  let service: GsapAnimationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    service = TestBed.inject(GsapAnimationsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('canAnimate() should return false in server context', () => {
    expect(service.canAnimate()).toBe(false);
  });

  it('animateThemeChange() should invoke the onSwap callback', async () => {
    let called = false;
    await service.animateThemeChange(() => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('animateThemeChange() should return a resolved Promise', async () => {
    const result = await service.animateThemeChange(() => {});
    expect(result).toBeUndefined();
  });

  it('animateCounter() should set textContent directly when not animating', () => {
    const el = document.createElement('span');
    service.animateCounter(el, 42, '%');
    expect(el.textContent).toBe('42%');
  });

  it('animateCounter() should use empty string suffix by default', () => {
    const el = document.createElement('span');
    service.animateCounter(el, 100);
    expect(el.textContent).toBe('100');
  });

  it('animatePageLeave() should invoke onComplete immediately when not animating', () => {
    const el = document.createElement('div');
    let called = false;
    service.animatePageLeave(el, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('animatePanelOut() should invoke onComplete immediately when not animating', () => {
    const el = document.createElement('div');
    let called = false;
    service.animatePanelOut(el, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('animateDrawerOut() should invoke onComplete immediately when not animating', () => {
    const el = document.createElement('div');
    let called = false;
    service.animateDrawerOut(el, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('addPressFeedback() should return a no-op cleanup function when not animating', () => {
    const el = document.createElement('button');
    const cleanup = service.addPressFeedback(el);
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });

  it('killAll() should not throw in server context', () => {
    expect(() => service.killAll()).not.toThrow();
  });

  // ── fix-018: reveal premium de bento grid ──────────────────────────────────
  describe('animateBentoGrid (fix-018)', () => {
    it('should return a no-op cleanup function when container is null', () => {
      const cleanup = service.animateBentoGrid(null);
      expect(typeof cleanup).toBe('function');
      expect(() => cleanup()).not.toThrow();
    });

    it('should not throw and return a cleanup function for a real grid', () => {
      const grid = document.createElement('div');
      grid.className = 'bento-grid';
      grid.appendChild(document.createElement('div'));
      grid.appendChild(document.createElement('div'));

      let cleanup!: () => void;
      expect(() => (cleanup = service.animateBentoGrid(grid))).not.toThrow();
      expect(typeof cleanup).toBe('function');
      expect(() => cleanup()).not.toThrow();
    });

    it('should remove the .is-reveal-pending pre-hide class (anti-flash contract)', () => {
      const grid = document.createElement('div');
      grid.className = 'bento-grid is-reveal-pending';
      grid.appendChild(document.createElement('div'));

      service.animateBentoGrid(grid);

      expect(grid.classList.contains('is-reveal-pending')).toBe(false);
    });

    it('should reveal cells (opacity 1) when reduced/no-animate', () => {
      const grid = document.createElement('div');
      grid.className = 'bento-grid is-reveal-pending';
      const cell = document.createElement('div');
      grid.appendChild(cell);

      service.animateBentoGrid(grid);

      // En contexto server shouldAnimate()=false → estado final visible inmediato.
      expect(cell.style.opacity).toBe('1');
    });
  });
});
