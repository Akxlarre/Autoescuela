import { TestBed } from "@angular/core/testing";
import { ModalOverlayService } from "./modal-overlay.service";

describe("ModalOverlayService", () => {
  let service: ModalOverlayService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ModalOverlayService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should start with a null container", () => {
    expect(service.container()).toBeNull();
  });

  it("setContainer() should store the provided element", () => {
    const el = document.createElement("div");
    service.setContainer(el);
    expect(service.container()).toBe(el);
  });

  it("clearContainer() should reset container to null", () => {
    const el = document.createElement("div");
    service.setContainer(el);
    service.clearContainer();
    expect(service.container()).toBeNull();
  });

  it("container() should be readonly (not directly settable from outside)", () => {
    // The exposed signal is asReadonly — it has no set() method.
    expect((service.container as any).set).toBeUndefined();
  });
});
