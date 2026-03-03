import { TestBed } from "@angular/core/testing";
import { PLATFORM_ID } from "@angular/core";
import { GsapAnimationsService } from "./gsap-animations.service";

/**
 * Tests run with PLATFORM_ID='server' so shouldAnimate() returns false.
 * This covers the "no-op / fallback" paths without triggering real GSAP tweens.
 */
describe("GsapAnimationsService (server context)", () => {
  let service: GsapAnimationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: "server" }],
    });
    service = TestBed.inject(GsapAnimationsService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("canAnimate() should return false in server context", () => {
    expect(service.canAnimate()).toBeFalse();
  });

  it("animateThemeChange() should invoke the onSwap callback", async () => {
    let called = false;
    await service.animateThemeChange(() => {
      called = true;
    });
    expect(called).toBeTrue();
  });

  it("animateThemeChange() should return a resolved Promise", async () => {
    await expectAsync(service.animateThemeChange(() => {})).toBeResolved();
  });

  it("animateCounter() should set textContent directly when not animating", () => {
    const el = document.createElement("span");
    service.animateCounter(el, 42, "%");
    expect(el.textContent).toBe("42%");
  });

  it("animateCounter() should use empty string suffix by default", () => {
    const el = document.createElement("span");
    service.animateCounter(el, 100);
    expect(el.textContent).toBe("100");
  });

  it("animatePageLeave() should invoke onComplete immediately when not animating", () => {
    const el = document.createElement("div");
    let called = false;
    service.animatePageLeave(el, () => {
      called = true;
    });
    expect(called).toBeTrue();
  });

  it("animatePanelOut() should invoke onComplete immediately when not animating", () => {
    const el = document.createElement("div");
    let called = false;
    service.animatePanelOut(el, () => {
      called = true;
    });
    expect(called).toBeTrue();
  });

  it("animateDrawerOut() should invoke onComplete immediately when not animating", () => {
    const el = document.createElement("div");
    let called = false;
    service.animateDrawerOut(el, () => {
      called = true;
    });
    expect(called).toBeTrue();
  });

  it("addPressFeedback() should return a no-op cleanup function when not animating", () => {
    const el = document.createElement("button");
    const cleanup = service.addPressFeedback(el);
    expect(typeof cleanup).toBe("function");
    expect(() => cleanup()).not.toThrow();
  });

  it("killAll() should not throw in server context", () => {
    expect(() => service.killAll()).not.toThrow();
  });
});
