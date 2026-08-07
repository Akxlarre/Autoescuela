import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LucideAngularModule, AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-angular';
import { AlertCardComponent, AlertSeverity } from './alert-card.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

// TODO: Component template tests require @analogjs/vite-plugin-angular for compilation.
// Adding that plugin to vitest.config.ts breaks TestBed for all facade/service tests.
// Track resolution in: fix vitest.config.ts to support both Angular plugin + TestBed.
describe.skip('AlertCardComponent', () => {
  let fixture: ComponentFixture<AlertCardComponent>;
  let component: AlertCardComponent;

  const gsapMock = { animateSkeletonToContent: vi.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AlertCardComponent,
        LucideAngularModule.pick({ AlertCircle, AlertTriangle, Info, CheckCircle }),
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

  it("should use --state-info tokens for severity 'info' (default), never --color-primary", () => {
    expect(fixture.nativeElement.style.background).toContain('--state-info-bg');
    expect(fixture.nativeElement.style.borderLeft).toContain('--state-info');
    expect(fixture.nativeElement.style.borderLeft).not.toContain('--color-primary');
  });

  const severities: AlertSeverity[] = ['error', 'warning', 'info', 'success'];

  severities.forEach((sev) => {
    it(`should tint background with --state-${sev}-bg for severity '${sev}'`, () => {
      fixture.componentRef.setInput('severity', sev);
      fixture.detectChanges();
      expect(fixture.nativeElement.style.background).toContain(`--state-${sev}-bg`);
    });

    it(`should apply a real border-left in --state-${sev} for severity '${sev}'`, () => {
      fixture.componentRef.setInput('severity', sev);
      fixture.detectChanges();
      expect(fixture.nativeElement.style.borderLeft).toContain(`--state-${sev}`);
    });
  });

  it('should project content via ng-content', () => {
    const contentDiv = fixture.nativeElement.querySelector('.text-sm.text-text-secondary');
    expect(contentDiv).toBeTruthy();
  });
});
