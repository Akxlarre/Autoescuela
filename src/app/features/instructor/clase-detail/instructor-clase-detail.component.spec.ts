import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { InstructorClaseDetailComponent } from './instructor-clase-detail.component';
import { InstructorClasesFacade } from '@core/facades/instructor-clases.facade';

describe('InstructorClaseDetailComponent — errores de lectura (0060-b)', () => {
  it('muestra app-empty-state con detailError() y Reintentar llama reintentarDetail()', () => {
    const reintentarDetailSpy = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [InstructorClaseDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: of({ id: '22' }) } },
        {
          provide: InstructorClasesFacade,
          useValue: {
            detailLoading: signal(false).asReadonly(),
            detailError: signal<string | null>(
              'No se pudo cargar el detalle de la clase.',
            ).asReadonly(),
            selectedClass: signal(null).asReadonly(),
            loadClassDetail: vi.fn().mockResolvedValue(undefined),
            reintentarDetail: reintentarDetailSpy,
            finishClass: vi.fn(),
            showSuccess: vi.fn(),
            showError: vi.fn(),
          },
        },
      ],
    }).overrideComponent(InstructorClaseDetailComponent, {
      set: { imports: [FormsModule], schemas: [NO_ERRORS_SCHEMA] },
    });

    const fixture = TestBed.createComponent(InstructorClaseDetailComponent);
    fixture.detectChanges();

    const emptyEl = fixture.nativeElement.querySelector('app-empty-state') as any;
    expect(emptyEl).not.toBeNull();
    expect(emptyEl.message).toBe('No se pudo cargar el detalle de la clase.');
    expect(emptyEl.getAttribute('actionLabel')).toBe('Reintentar');

    emptyEl.dispatchEvent(new CustomEvent('action'));
    expect(reintentarDetailSpy).toHaveBeenCalledTimes(1);
  });
});
