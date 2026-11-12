import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { InstructorEvaluacionComponent } from './instructor-evaluacion.component';
import { InstructorClasesFacade } from '@core/facades/instructor-clases.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

describe('InstructorEvaluacionComponent — errores de lectura (0060-b)', () => {
  it('muestra app-empty-state con detailError() y Reintentar llama reintentarDetail()', () => {
    const reintentarDetailSpy = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [InstructorEvaluacionComponent],
      providers: [
        { provide: LayoutDrawerFacadeService, useValue: { close: vi.fn() } },
        {
          provide: InstructorClasesFacade,
          useValue: {
            detailLoading: signal(false).asReadonly(),
            detailError: signal<string | null>(
              'No se pudo cargar el detalle de la clase.',
            ).asReadonly(),
            selectedClass: signal(null).asReadonly(),
            reintentarDetail: reintentarDetailSpy,
            saveEvaluation: vi.fn(),
            showSuccess: vi.fn(),
            showError: vi.fn(),
          },
        },
      ],
    }).overrideComponent(InstructorEvaluacionComponent, {
      set: { imports: [ReactiveFormsModule], schemas: [NO_ERRORS_SCHEMA] },
    });

    const fixture = TestBed.createComponent(InstructorEvaluacionComponent);
    fixture.detectChanges();

    const emptyEl = fixture.nativeElement.querySelector('app-empty-state') as any;
    expect(emptyEl).not.toBeNull();
    expect(emptyEl.message).toBe('No se pudo cargar el detalle de la clase.');
    expect(emptyEl.getAttribute('actionLabel')).toBe('Reintentar');

    emptyEl.dispatchEvent(new CustomEvent('action'));
    expect(reintentarDetailSpy).toHaveBeenCalledTimes(1);
  });
});
