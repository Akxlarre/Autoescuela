import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  LucideAngularModule,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
} from 'lucide-angular';
import { AlertCardComponent, AlertSeverity } from './alert-card.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

// TODO: Component template tests require @analogjs/vite-plugin-angular for compilation.
// Adding that plugin to vitest.config.ts breaks TestBed for all facade/service tests.
// Track resolution in: fix vitest.config.ts to support both Angular plugin + TestBed.
describe.skip('AlertCardComponent', () => {
  let fixture: ComponentFixture<AlertCardComponent>;
  let component: AlertCardComponent;

  const gsapMock = { addPressFeedback: vi.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AlertCardComponent,
        LucideAngularModule.pick({ AlertCircle, AlertTriangle, Info, CheckCircle, X }),
      ],
      providers: [{ provide: GsapAnimationsService, useValue: gsapMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(AlertCardComponent);
    fixture.componentRef.setInput('title', 'Mensaje de prueba');
    fixture.detectChanges();
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it("host should have role='alert'", () => {
    expect(fixture.nativeElement.getAttribute('role')).toBe('alert');
  });

  it('should render the title', () => {
    const titleEl = fixture.nativeElement.querySelector('p');
    expect(titleEl?.textContent?.trim()).toBe('Mensaje de prueba');
  });

  it("should default to severity 'info'", () => {
    expect(component.severity()).toBe('info');
  });

  it("should apply .alert-info class when severity is 'info' (default)", () => {
    expect(fixture.nativeElement.classList).toContain('alert-info');
  });

  const severities: AlertSeverity[] = ['error', 'warning', 'info', 'success'];

  severities.forEach((sev) => {
    it(`should apply .alert-${sev} class for severity '${sev}'`, () => {
      fixture.componentRef.setInput('severity', sev);
      fixture.detectChanges();
      expect(fixture.nativeElement.classList).toContain(`alert-${sev}`);
    });

    it(`should NOT apply other severity classes when severity is '${sev}'`, () => {
      fixture.componentRef.setInput('severity', sev);
      fixture.detectChanges();
      const others = severities.filter((s) => s !== sev);
      others.forEach((other) => {
        expect(fixture.nativeElement.classList).not.toContain(`alert-${other}`);
      });
    });
  });

  it('should render the accent bar', () => {
    const bar = fixture.nativeElement.querySelector('.absolute');
    expect(bar).toBeTruthy();
  });

  it('should project content via ng-content', () => {
    const contentDiv = fixture.nativeElement.querySelector('.text-sm.text-text-secondary');
    expect(contentDiv).toBeTruthy();
  });

  it('should NOT render action button when actionLabel is not provided', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(0);
  });

  it('should render action button when actionLabel is provided', () => {
    fixture.componentRef.setInput('actionLabel', 'Reintentar');
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button');
    expect(btn).toBeTruthy();
    expect(btn.textContent?.trim()).toBe('Reintentar');
  });

  it('should emit action when action button is clicked', () => {
    fixture.componentRef.setInput('actionLabel', 'Reintentar');
    fixture.detectChanges();
    const spy = vi.fn();
    component.action.subscribe(spy);
    fixture.nativeElement.querySelector('button').click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should NOT render dismiss button when dismissible is false (default)', () => {
    const dismissBtn = fixture.nativeElement.querySelector("[aria-label='Cerrar']");
    expect(dismissBtn).toBeNull();
  });

  it('should render dismiss button when dismissible is true', () => {
    fixture.componentRef.setInput('dismissible', true);
    fixture.detectChanges();
    const dismissBtn = fixture.nativeElement.querySelector("[aria-label='Cerrar']");
    expect(dismissBtn).toBeTruthy();
  });

  it('should emit dismissed when dismiss button is clicked', () => {
    fixture.componentRef.setInput('dismissible', true);
    fixture.detectChanges();
    const spy = vi.fn();
    component.dismissed.subscribe(spy);
    fixture.nativeElement.querySelector("[aria-label='Cerrar']").click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("dismiss button should have aria-label='Cerrar'", () => {
    fixture.componentRef.setInput('dismissible', true);
    fixture.detectChanges();
    const dismissBtn = fixture.nativeElement.querySelector("[aria-label='Cerrar']");
    expect(dismissBtn.getAttribute('aria-label')).toBe('Cerrar');
  });
});
