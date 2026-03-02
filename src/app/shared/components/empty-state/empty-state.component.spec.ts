import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideIcons, Search, Plus, X } from "lucide-angular";
import { EmptyStateComponent } from "./empty-state.component";
import { GsapAnimationsService } from "@core/services/gsap-animations.service";

describe("EmptyStateComponent", () => {
  let fixture: ComponentFixture<EmptyStateComponent>;
  let component: EmptyStateComponent;

  const gsapMock = jasmine.createSpyObj("GsapAnimationsService", [
    "addPressFeedback",
  ]);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
      providers: [
        { provide: GsapAnimationsService, useValue: gsapMock },
        provideIcons({ Search, Plus, X }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput("message", "No hay resultados");
    fixture.detectChanges();
    component = fixture.componentInstance;
  });

  // ── Creación ───────────────────────────────────────────────────────────────

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("host should have role='status'", () => {
    expect(fixture.nativeElement.getAttribute("role")).toBe("status");
  });

  it("host aria-label should equal the message", () => {
    expect(fixture.nativeElement.getAttribute("aria-label")).toBe(
      "No hay resultados"
    );
  });

  // ── Mensaje ────────────────────────────────────────────────────────────────

  it("should render the message text", () => {
    expect(fixture.nativeElement.textContent).toContain("No hay resultados");
  });

  // ── Ícono ─────────────────────────────────────────────────────────────────

  it("should NOT render icon container when icon is not provided", () => {
    const iconWrapper = fixture.nativeElement.querySelector(
      "[aria-hidden='true']"
    );
    expect(iconWrapper).toBeNull();
  });

  it("should render icon container when icon is provided", () => {
    fixture.componentRef.setInput("icon", "search");
    fixture.detectChanges();
    const iconWrapper = fixture.nativeElement.querySelector("[aria-hidden]");
    expect(iconWrapper).toBeTruthy();
  });

  // ── Subtítulo ──────────────────────────────────────────────────────────────

  it("should NOT render subtitle when not provided", () => {
    const paragraphs = fixture.nativeElement.querySelectorAll("p");
    // Solo el mensaje principal (1 párrafo)
    expect(paragraphs.length).toBe(1);
  });

  it("should render subtitle when provided", () => {
    fixture.componentRef.setInput(
      "subtitle",
      "Intenta con otros términos de búsqueda."
    );
    fixture.detectChanges();
    const paragraphs = fixture.nativeElement.querySelectorAll("p");
    // Mensaje + subtítulo (2 párrafos)
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[1].textContent?.trim()).toBe(
      "Intenta con otros términos de búsqueda."
    );
  });

  // ── Botón de acción ────────────────────────────────────────────────────────

  it("should NOT render action button when actionLabel is not provided", () => {
    const btn = fixture.nativeElement.querySelector("button");
    expect(btn).toBeNull();
  });

  it("should render action button when actionLabel is provided", () => {
    fixture.componentRef.setInput("actionLabel", "Limpiar filtros");
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector("button");
    expect(btn).toBeTruthy();
    expect(btn.textContent?.trim()).toContain("Limpiar filtros");
  });

  it("should emit action when action button is clicked", () => {
    fixture.componentRef.setInput("actionLabel", "Crear elemento");
    fixture.detectChanges();
    const spy = jasmine.createSpy("action");
    component.action.subscribe(spy);
    fixture.nativeElement.querySelector("button").click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("action button aria-label should equal actionLabel", () => {
    fixture.componentRef.setInput("actionLabel", "Invitar usuario");
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector("button");
    expect(btn.getAttribute("aria-label")).toBe("Invitar usuario");
  });
});
