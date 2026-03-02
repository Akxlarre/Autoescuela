import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideIcons, TrendingUp, TrendingDown } from "lucide-angular";
import { KpiCardComponent } from "./kpi-card.component";
import { GsapAnimationsService } from "@core/services/gsap-animations.service";

describe("KpiCardComponent", () => {
  let fixture: ComponentFixture<KpiCardComponent>;
  let component: KpiCardComponent;

  const gsapMock = jasmine.createSpyObj("GsapAnimationsService", [
    "animateCounter",
  ]);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KpiCardComponent],
      providers: [
        { provide: GsapAnimationsService, useValue: gsapMock },
        provideIcons({ TrendingUp, TrendingDown }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(KpiCardComponent);
    fixture.componentRef.setInput("value", 1000);
    fixture.componentRef.setInput("label", "Usuarios activos");
    fixture.detectChanges();
    component = fixture.componentInstance;
  });

  // ── Creación y estructura base ─────────────────────────────────────────────

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should render .kpi-label with the label text", () => {
    const el = fixture.nativeElement.querySelector(".kpi-label");
    expect(el?.textContent?.trim()).toBe("Usuarios activos");
  });

  it("should render .kpi-value container", () => {
    expect(fixture.nativeElement.querySelector(".kpi-value")).toBeTruthy();
  });

  // ── Prefix y Suffix ────────────────────────────────────────────────────────

  it("should display prefix when provided", () => {
    fixture.componentRef.setInput("prefix", "$");
    fixture.detectChanges();
    const kpiValue = fixture.nativeElement.querySelector(".kpi-value");
    expect(kpiValue?.textContent).toContain("$");
  });

  it("should NOT display prefix span when prefix is empty (default)", () => {
    // No prefix → el span condicional no debe existir
    const spans = fixture.nativeElement
      .querySelector(".kpi-value")
      ?.querySelectorAll("span");
    // Solo el span #valueEl debe existir cuando no hay prefix ni suffix
    expect(spans?.length).toBe(1);
  });

  it("should display suffix when provided", () => {
    fixture.componentRef.setInput("suffix", "%");
    fixture.detectChanges();
    const kpiValue = fixture.nativeElement.querySelector(".kpi-value");
    expect(kpiValue?.textContent).toContain("%");
  });

  // ── Trend — ausencia cuando es undefined ──────────────────────────────────

  it("should NOT render trend section when trend is undefined (default)", () => {
    // El div de trend tiene [attr.aria-label] → ausencia confirma que no renderizó
    const trendEl = fixture.nativeElement.querySelector(".kpi-value ~ div");
    expect(trendEl).toBeNull();
  });

  // ── Trend — presencia con valor positivo ──────────────────────────────────

  it("should render trend section when trend is provided", () => {
    fixture.componentRef.setInput("trend", 12.4);
    fixture.detectChanges();
    const trendEl = fixture.nativeElement.querySelector("[aria-label]");
    expect(trendEl).toBeTruthy();
  });

  it("should include 'incremento' in aria-label for positive trend", () => {
    fixture.componentRef.setInput("trend", 12.4);
    fixture.detectChanges();
    const trendEl = fixture.nativeElement.querySelector("[aria-label]");
    expect(trendEl?.getAttribute("aria-label")).toContain("incremento");
  });

  it("should display '+X%' in trend text for positive values", () => {
    fixture.componentRef.setInput("trend", 12.4);
    fixture.detectChanges();
    // trendDisplay() para 12.4 → '+12.4%'
    expect(
      fixture.nativeElement.querySelector("[aria-label]")?.textContent
    ).toContain("+12.4%");
  });

  it("should display '+X%' (no decimal) for whole-number positive trend", () => {
    fixture.componentRef.setInput("trend", 5);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector("[aria-label]")?.textContent
    ).toContain("+5%");
  });

  // ── Trend — presencia con valor negativo ──────────────────────────────────

  it("should include 'descenso' in aria-label for negative trend", () => {
    fixture.componentRef.setInput("trend", -3.1);
    fixture.detectChanges();
    const trendEl = fixture.nativeElement.querySelector("[aria-label]");
    expect(trendEl?.getAttribute("aria-label")).toContain("descenso");
  });

  it("should display absolute value (no minus sign) in trend text for negative values", () => {
    // El signo negativo se comunica visualmente via ícono trending-down + color rojo.
    // trendDisplay() para -3.1 → '3.1%' (sin '-' porque el ícono lo indica)
    fixture.componentRef.setInput("trend", -3.1);
    fixture.detectChanges();
    const trendContent = fixture.nativeElement.querySelector(
      "[aria-label]"
    )?.textContent;
    expect(trendContent).toContain("3.1%");
    expect(trendContent).not.toContain("-3.1%");
  });

  // ── trendLabel en aria-label ───────────────────────────────────────────────

  it("should include trendLabel in aria-label when provided", () => {
    fixture.componentRef.setInput("trend", 8.0);
    fixture.componentRef.setInput("trendLabel", "vs. mes anterior");
    fixture.detectChanges();
    const ariaLabel = fixture.nativeElement
      .querySelector("[aria-label]")
      ?.getAttribute("aria-label");
    expect(ariaLabel).toContain("vs. mes anterior");
  });

  // ── Accent class ──────────────────────────────────────────────────────────

  it("should NOT apply .card-accent by default", () => {
    const card = fixture.nativeElement.querySelector(".card");
    expect(card?.classList).not.toContain("card-accent");
  });

  it("should apply .card-accent when accent is true", () => {
    fixture.componentRef.setInput("accent", true);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector(".card");
    expect(card?.classList).toContain("card-accent");
  });

  it("should have .card-tinted class always", () => {
    const card = fixture.nativeElement.querySelector(".card");
    expect(card?.classList).toContain("card-tinted");
  });
});
