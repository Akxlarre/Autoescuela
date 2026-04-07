import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LucideAngularModule, Settings, CircleAlert } from 'lucide-angular';
import { IconComponent } from './icon.component';

// TODO: Component template tests require @analogjs/vite-plugin-angular for compilation.
// Adding that plugin to vitest.config.ts breaks TestBed for all facade/service tests.
// Track resolution in: fix vitest.config.ts to support both Angular plugin + TestBed.
describe.skip('IconComponent', () => {
  let fixture: ComponentFixture<IconComponent>;
  let component: IconComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconComponent, LucideAngularModule.pick({ Settings, CircleAlert })],
    }).compileComponents();

    fixture = TestBed.createComponent(IconComponent);
    fixture.componentRef.setInput('name', 'settings');
    fixture.detectChanges();
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render a lucide-icon element', () => {
    const icon = fixture.nativeElement.querySelector('lucide-icon');
    expect(icon).toBeTruthy();
  });

  it("should apply aria-hidden='true' by default", () => {
    const icon = fixture.nativeElement.querySelector('lucide-icon');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
  });

  it('should remove aria-hidden when ariaHidden is false', () => {
    fixture.componentRef.setInput('ariaHidden', false);
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('lucide-icon');
    expect(icon.getAttribute('aria-hidden')).toBeNull();
  });

  it('should apply aria-label when ariaHidden is false and ariaLabel is set', () => {
    fixture.componentRef.setInput('ariaHidden', false);
    fixture.componentRef.setInput('ariaLabel', 'Error de validación');
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('lucide-icon');
    expect(icon.getAttribute('aria-label')).toBe('Error de validación');
  });

  it('should NOT apply aria-label when ariaHidden is true (decorative)', () => {
    fixture.componentRef.setInput('ariaHidden', true);
    fixture.componentRef.setInput('ariaLabel', 'should be ignored');
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('lucide-icon');
    // aria-label null cuando el ícono es decorativo
    expect(icon.getAttribute('aria-label')).toBeNull();
  });

  it('should default to size 16', () => {
    expect(component.size()).toBe(16);
  });

  it('should accept custom size', () => {
    fixture.componentRef.setInput('size', 24);
    fixture.detectChanges();
    expect(component.size()).toBe(24);
  });

  it('should default color to currentColor', () => {
    expect(component.color()).toBe('currentColor');
  });

  it('should render with a different icon name', () => {
    fixture.componentRef.setInput('name', 'circle-alert');
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('lucide-icon');
    expect(icon).toBeTruthy();
  });
});
