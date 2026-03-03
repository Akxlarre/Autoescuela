import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { BreadcrumbService } from "./breadcrumb.service";

@Component({ standalone: true, template: "" })
class StubPage {}

describe("BreadcrumbService", () => {
  let service: BreadcrumbService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: "", component: StubPage },
          { path: "**", component: StubPage },
        ]),
      ],
    });
    service = TestBed.inject(BreadcrumbService);
    router = TestBed.inject(Router);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("home should always have routerLink '/'", () => {
    expect(service.breadcrumb().home.routerLink).toBe("/");
  });

  it("home should have a label and an icon", () => {
    expect(service.breadcrumb().home.label).toBeTruthy();
    expect(service.breadcrumb().home.icon).toBeTruthy();
  });

  it("breadcrumb items should be empty on the root route '/'", async () => {
    await router.navigateByUrl("/");
    expect(service.breadcrumb().items.length).toBe(0);
  });

  it("breadcrumb items should contain the matched menu label for '/settings'", async () => {
    await router.navigateByUrl("/settings");
    const items = service.breadcrumb().items;
    expect(items.length).toBe(1);
    expect(items[0].label).toBe("Configuración");
  });

  it("the active breadcrumb item should have no routerLink (current page)", async () => {
    await router.navigateByUrl("/settings");
    const last = service.breadcrumb().items.at(-1);
    expect(last?.routerLink).toBeUndefined();
  });

  it("breadcrumb items should be empty for an unknown URL", async () => {
    await router.navigateByUrl("/unknown-route-xyz");
    expect(service.breadcrumb().items.length).toBe(0);
  });
});
