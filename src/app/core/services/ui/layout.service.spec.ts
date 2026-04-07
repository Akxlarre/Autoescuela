import { TestBed } from "@angular/core/testing";
import { LayoutService } from "./layout.service";

describe("LayoutService", () => {
  let service: LayoutService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LayoutService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should start with sidebar closed", () => {
    expect(service.sidebarOpen()).toBe(false);
  });

  it("openSidebar() should set sidebarOpen to true", () => {
    service.openSidebar();
    expect(service.sidebarOpen()).toBe(true);
  });

  it("closeSidebar() should set sidebarOpen to false", () => {
    service.openSidebar();
    service.closeSidebar();
    expect(service.sidebarOpen()).toBe(false);
  });

  it("toggleSidebar() should flip the state each call", () => {
    service.toggleSidebar();
    expect(service.sidebarOpen()).toBe(true);
    service.toggleSidebar();
    expect(service.sidebarOpen()).toBe(false);
  });
});
