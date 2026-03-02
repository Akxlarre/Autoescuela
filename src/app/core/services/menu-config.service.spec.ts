import { TestBed } from "@angular/core/testing";
import { MenuConfigService } from "./menu-config.service";

describe("MenuConfigService", () => {
  let service: MenuConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MenuConfigService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("menuItems() should return a non-empty array", () => {
    expect(service.menuItems().length).toBeGreaterThan(0);
  });

  it("every item should have label, icon, and routerLink", () => {
    service.menuItems().forEach((item) => {
      expect(item.label).toBeTruthy();
      expect(item.icon).toBeTruthy();
      expect(item.routerLink).toBeTruthy();
    });
  });

  it("no icon should use 'pi pi-' prefix — must be Lucide names", () => {
    service.menuItems().forEach((item) => {
      expect(item.icon.startsWith("pi ")).toBeFalse();
    });
  });

  it("dashboard item should be the first item with path /app/dashboard", () => {
    const first = service.menuItems()[0];
    expect(first.routerLink).toBe("/app/dashboard");
    expect(first.icon).toBe("layout-dashboard");
  });

  it("every routerLink should start with '/'", () => {
    service.menuItems().forEach((item) => {
      expect(item.routerLink.startsWith("/")).toBeTrue();
    });
  });
});
