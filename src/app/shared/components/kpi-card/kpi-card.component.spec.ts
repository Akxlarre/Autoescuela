import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LucideAngularModule, TrendingUp, TrendingDown } from 'lucide-angular';
import { KpiCardComponent } from './kpi-card.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

// TODO: Component template tests require @analogjs/vite-plugin-angular for compilation.
// Adding that plugin to vitest.config.ts breaks TestBed for all facade/service tests.
// Track resolution in: fix vitest.config.ts to support both Angular plugin + TestBed.
describe.skip('KpiCardComponent', () => {
  let fixture: ComponentFixture<KpiCardComponent>;
  let component: KpiCardComponent;

  const gsapMock = { animateCounter: vi.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KpiCardComponent, LucideAngularModule.pick({ TrendingUp, TrendingDown })],
      providers: [{ provide: GsapAnimationsService, useValue: gsapMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(KpiCardComponent);
    fixture.componentRef.setInput('value', 1000);
    fixture.componentRef.setInput('label', 'Usuarios activos');
    fixture.detectChanges();
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render .kpi-label with the label text', () => {
    const el = fixture.nativeElement.querySelector('.kpi-label');
    expect(el?.textContent?.trim()).toBe('Usuarios activos');
  });

  it('should render .kpi-value container', () => {
    expect(fixture.nativeElement.querySelector('.kpi-value')).toBeTruthy();
  });

  it('should display prefix when provided', () => {
    fixture.componentRef.setInput('prefix', '$');
    fixture.detectChanges();
    const kpiValue = fixture.nativeElement.querySelector('.kpi-value');
    expect(kpiValue?.textContent).toContain('$');
  });

  it('should NOT display prefix span when prefix is empty (default)', () => {
    const spans = fixture.nativeElement.querySelector('.kpi-value')?.querySelectorAll('span');
    expect(spans?.length).toBe(1);
  });

  it('should display suffix when provided', () => {
    fixture.componentRef.setInput('suffix', '%');
    fixture.detectChanges();
    const kpiValue = fixture.nativeElement.querySelector('.kpi-value');
    expect(kpiValue?.textContent).toContain('%');
  });

  it('should NOT render trend section when trend is undefined (default)', () => {
    const trendEl = fixture.nativeElement.querySelector('.kpi-value ~ div');
    expect(trendEl).toBeNull();
  });

  it('should render trend section when trend is provided', () => {
    fixture.componentRef.setInput('trend', 12.4);
    fixture.detectChanges();
    const trendEl = fixture.nativeElement.querySelector('[aria-label]');
    expect(trendEl).toBeTruthy();
  });

  it("should include 'incremento' in aria-label for positive trend", () => {
    fixture.componentRef.setInput('trend', 12.4);
    fixture.detectChanges();
    const trendEl = fixture.nativeElement.querySelector('[aria-label]');
    expect(trendEl?.getAttribute('aria-label')).toContain('incremento');
  });

  it("should display '+X%' in trend text for positive values", () => {
    fixture.componentRef.setInput('trend', 12.4);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label]')?.textContent).toContain('+12.4%');
  });

  it("should display '+X%' (no decimal) for whole-number positive trend", () => {
    fixture.componentRef.setInput('trend', 5);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label]')?.textContent).toContain('+5%');
  });

  it("should include 'descenso' in aria-label for negative trend", () => {
    fixture.componentRef.setInput('trend', -3.1);
    fixture.detectChanges();
    const trendEl = fixture.nativeElement.querySelector('[aria-label]');
    expect(trendEl?.getAttribute('aria-label')).toContain('descenso');
  });

  it('should display absolute value (no minus sign) in trend text for negative values', () => {
    fixture.componentRef.setInput('trend', -3.1);
    fixture.detectChanges();
    const trendContent = fixture.nativeElement.querySelector('[aria-label]')?.textContent;
    expect(trendContent).toContain('3.1%');
    expect(trendContent).not.toContain('-3.1%');
  });

  it('should include trendLabel in aria-label when provided', () => {
    fixture.componentRef.setInput('trend', 8.0);
    fixture.componentRef.setInput('trendLabel', 'vs. mes anterior');
    fixture.detectChanges();
    const ariaLabel = fixture.nativeElement
      .querySelector('[aria-label]')
      ?.getAttribute('aria-label');
    expect(ariaLabel).toContain('vs. mes anterior');
  });

  it('should NOT apply .card-accent by default', () => {
    const card = fixture.nativeElement.querySelector('.card');
    expect(card?.classList).not.toContain('card-accent');
  });

  it('should apply .card-accent when accent is true', () => {
    fixture.componentRef.setInput('accent', true);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.card');
    expect(card?.classList).toContain('card-accent');
  });

  it('should have .card-tinted class always', () => {
    const card = fixture.nativeElement.querySelector('.card');
    expect(card?.classList).toContain('card-tinted');
  });
});
