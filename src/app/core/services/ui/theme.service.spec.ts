import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { GsapAnimationsService } from './gsap-animations.service';
import { MessageService } from 'primeng/api';

describe('ThemeService', () => {
  let service: ThemeService;
  let gsapSpy: any;
  let messageSpy: any;

  beforeEach(() => {
    // Ensure clean state before each test
    localStorage.removeItem('app-color-mode');
    document.documentElement.removeAttribute('data-mode');

    gsapSpy = { animateThemeChange: vi.fn() };
    // Mock calls the callback synchronously so state changes are immediate
    gsapSpy.animateThemeChange.mockImplementation((callback) => {
      callback();
      return Promise.resolve();
    });

    messageSpy = { add: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: GsapAnimationsService, useValue: gsapSpy },
        { provide: MessageService, useValue: messageSpy },
      ],
    });

    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.removeItem('app-color-mode');
    document.documentElement.removeAttribute('data-mode');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('darkMode should start as false when no preference is saved', () => {
    expect(service.darkMode()).toBe(false);
  });

  it('isThemeTransitioning should start as false', () => {
    expect(service.isThemeTransitioning()).toBe(false);
  });

  it("setColorMode('dark') should set darkMode to true", () => {
    service.setColorMode('dark');
    expect(service.darkMode()).toBe(true);
  });

  it("setColorMode('dark') should apply data-mode='dark' to documentElement", () => {
    service.setColorMode('dark');
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark');
  });

  it("setColorMode('light') after dark should revert darkMode to false", async () => {
    service.setColorMode('dark');
    // Flush the .finally() microtask so isThemeTransitioning resets
    await Promise.resolve();
    service.setColorMode('light');
    expect(service.darkMode()).toBe(false);
  });

  it("setColorMode('light') after dark should remove data-mode attribute", async () => {
    service.setColorMode('dark');
    await Promise.resolve();
    service.setColorMode('light');
    expect(document.documentElement.getAttribute('data-mode')).toBeNull();
  });

  it('cycleColorMode() should transition light → dark on first call', () => {
    service.cycleColorMode();
    expect(service.darkMode()).toBe(true);
  });

  it('cycleColorMode() should call animateThemeChange', () => {
    service.cycleColorMode();
    expect(gsapSpy.animateThemeChange).toHaveBeenCalled();
  });

  it('cycleColorMode() while transitioning should be a no-op', () => {
    // Simulate transitioning state
    service['isThemeTransitioning'].set(true);
    service.cycleColorMode();
    expect(gsapSpy.animateThemeChange).not.toHaveBeenCalled();
  });
});
