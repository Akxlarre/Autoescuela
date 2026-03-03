import { TestBed } from "@angular/core/testing";
import { ConfirmModalService } from "./confirm-modal.service";

describe("ConfirmModalService", () => {
  let service: ConfirmModalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConfirmModalService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should start with modal closed and no config", () => {
    expect(service.isOpen()).toBeFalse();
    expect(service.config()).toBeNull();
  });

  it("confirm() should open the modal with the provided config", () => {
    service.confirm({ title: "Eliminar", message: "¿Estás seguro?" });
    expect(service.isOpen()).toBeTrue();
    expect(service.config()?.title).toBe("Eliminar");
    expect(service.config()?.message).toBe("¿Estás seguro?");
  });

  it("confirm() should apply default labels when not provided", () => {
    service.confirm({ title: "T", message: "M" });
    expect(service.config()?.confirmLabel).toBe("Aceptar");
    expect(service.config()?.cancelLabel).toBe("Cancelar");
    expect(service.config()?.severity).toBe("secondary");
  });

  it("confirm() should use provided custom labels", () => {
    service.confirm({
      title: "T",
      message: "M",
      confirmLabel: "Sí, borrar",
      cancelLabel: "No",
      severity: "danger",
    });
    expect(service.config()?.confirmLabel).toBe("Sí, borrar");
    expect(service.config()?.cancelLabel).toBe("No");
    expect(service.config()?.severity).toBe("danger");
  });

  it("accept() should resolve the promise with true and close the modal", async () => {
    const result = service.confirm({ title: "T", message: "M" });
    service.accept();
    expect(await result).toBeTrue();
    expect(service.isOpen()).toBeFalse();
    expect(service.config()).toBeNull();
  });

  it("cancel() should resolve the promise with false and close the modal", async () => {
    const result = service.confirm({ title: "T", message: "M" });
    service.cancel();
    expect(await result).toBeFalse();
    expect(service.isOpen()).toBeFalse();
    expect(service.config()).toBeNull();
  });
});
