import { ComponentFixture, TestBed } from "@angular/core/testing";
import {
  provideIcons,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
} from "lucide-angular";
import { AlertCardComponent, AlertSeverity } from "./alert-card.component";
import { GsapAnimationsService } from "@core/services/gsap-animations.service";

describe("AlertCardComponent", () => {
  let fixture: ComponentFixture<AlertCardComponent>;
  let component: AlertCardComponent;

  const gsapMock = jasmine.createSpyObj("GsapAnimationsService", [
    "addPressFeedback",
  ]);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlertCardComponent],
      providers: [
        { provide: GsapAnimationsService, useValue: gsapMock },
        provideIcons({ AlertCircle, AlertTriangle, Info, CheckCircle, X }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AlertCardComponent);
    fixture.componentRef.setInput("title", "Mensaje de prueba");
    fixture.detectChanges();
    component = fixture.componentInstance;
  });

  // ── Creación y semántica ───────────────────────────────────────────────────

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("host should have role='alert'", () => {
    expect(fixture.nativeElement.getAttribute("role")).toBe("alert");
  });

  // ── Título ─────────────────────────────────────────────────────────────────

  it("should render the title", () => {
    const titleEl = fixture.nativeElement.querySelector("p");
    expect(titleEl?.textContent?.trim()).toBe("Mensaje de prueba");
  });

  // ── Severidad default ─────────────────────────────────────────────────────

  it("should default to severity 'info'", () => {
    expect(component.severity()).toBe("info");
  });

  it("should apply .alert-info class when severity is 'info' (default)", () => {
    expect(fixture.nativeElement.classList).toContain("alert-info");
  });

  // ── Severidades ────────────────────────────────────────────────────────────

  const severities: AlertSeverity[] = ["error", "warning", "info", "success"];

  severities.forEach((sev) => {
    it(`should apply .alert-${sev} class for severity '${sev}'`, () => {
      fixture.componentRef.setInput("severity", sev);
      fixture.detectChanges();
      expect(fixture.nativeElement.classList).toContain(`alert-${sev}`);
    });

    it(`should NOT apply other severity classes when severity is '${sev}'`, () => {
      fixture.componentRef.setInput("severity", sev);
      fixture.detectChanges();
      const others = severities.filter((s) => s !== sev);
      others.forEach((other) => {
        expect(fixture.nativeElement.classList).not.toContain(`alert-${other}`);
      });
    });
  });

  // ── Barra de acento ────────────────────────────────────────────────────────

  it("should render the accent bar", () => {
    const bar = fixture.nativeElement.querySelector(".absolute");
    expect(bar).toBeTruthy();
  });

  // ── ng-content ────────────────────────────────────────────────────────────

  it("should project content via ng-content", () => {
    // ng-content se valida via host binding de div.text-sm.text-text-secondary
    const contentDiv = fixture.nativeElement.querySelector(
      ".text-sm.text-text-secondary"
    );
    expect(contentDiv).toBeTruthy();
  });

  // ── Botón de acción ────────────────────────────────────────────────────────

  it("should NOT render action button when actionLabel is not provided", () => {
    // Solo el ícono de ícono wrapper y nada más — botón ausente
    const buttons = fixture.nativeElement.querySelectorAll("button");
    expect(buttons.length).toBe(0);
  });

  it("should render action button when actionLabel is provided", () => {
    fixture.componentRef.setInput("actionLabel", "Reintentar");
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector("button");
    expect(btn).toBeTruthy();
    expect(btn.textContent?.trim()).toBe("Reintentar");
  });

  it("should emit action when action button is clicked", () => {
    fixture.componentRef.setInput("actionLabel", "Reintentar");
    fixture.detectChanges();
    const spy = jasmine.createSpy("action");
    component.action.subscribe(spy);
    fixture.nativeElement.querySelector("button").click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  // ── Botón de descarte ──────────────────────────────────────────────────────

  it("should NOT render dismiss button when dismissible is false (default)", () => {
    const dismissBtn = fixture.nativeElement.querySelector(
      "[aria-label='Cerrar']"
    );
    expect(dismissBtn).toBeNull();
  });

  it("should render dismiss button when dismissible is true", () => {
    fixture.componentRef.setInput("dismissible", true);
    fixture.detectChanges();
    const dismissBtn = fixture.nativeElement.querySelector(
      "[aria-label='Cerrar']"
    );
    expect(dismissBtn).toBeTruthy();
  });

  it("should emit dismissed when dismiss button is clicked", () => {
    fixture.componentRef.setInput("dismissible", true);
    fixture.detectChanges();
    const spy = jasmine.createSpy("dismissed");
    component.dismissed.subscribe(spy);
    fixture.nativeElement.querySelector("[aria-label='Cerrar']").click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("dismiss button should have aria-label='Cerrar'", () => {
    fixture.componentRef.setInput("dismissible", true);
    fixture.detectChanges();
    const dismissBtn = fixture.nativeElement.querySelector(
      "[aria-label='Cerrar']"
    );
    expect(dismissBtn.getAttribute("aria-label")).toBe("Cerrar");
  });
});
