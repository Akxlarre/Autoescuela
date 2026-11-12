import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { InstructorFichaComponent } from './instructor-ficha.component';
import { InstructorAlumnosFacade } from '@core/facades/instructor-alumnos.facade';
import { InstructorClasesFacade } from '@core/facades/instructor-clases.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ChileDatePipe } from '@shared/pipes/chile-date.pipe';

describe('InstructorFichaComponent — errores de lectura (0060-b)', () => {
  it('muestra app-empty-state con detailError() sin mostrar ficha anterior ni requerir error de lista', () => {
    const loadDetailSpy = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [InstructorFichaComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { params: of({ id: '84' }) } },
        { provide: LayoutDrawerFacadeService, useValue: { isOpen: signal(false).asReadonly() } },
        {
          provide: InstructorClasesFacade,
          useValue: {
            evaluationSavedTick: signal(0).asReadonly(),
            openEvaluacionDrawer: vi.fn(),
          },
        },
        {
          provide: InstructorAlumnosFacade,
          useValue: {
            error: signal<string | null>(null).asReadonly(),
            detailError: signal<string | null>(
              'No se pudo cargar la ficha del alumno.',
            ).asReadonly(),
            detailLoading: signal(false).asReadonly(),
            studentDetail: signal(null).asReadonly(),
            loadStudentDetail: loadDetailSpy,
          },
        },
      ],
    }).overrideComponent(InstructorFichaComponent, {
      set: { imports: [ChileDatePipe, DecimalPipe], schemas: [NO_ERRORS_SCHEMA] },
    });

    const fixture = TestBed.createComponent(InstructorFichaComponent);
    fixture.detectChanges();

    const emptyEl = fixture.nativeElement.querySelector('app-empty-state') as any;
    expect(emptyEl).not.toBeNull();
    expect(emptyEl.message).toBe('No se pudo cargar la ficha del alumno.');
    expect(emptyEl.getAttribute('actionLabel')).toBe('Reintentar');

    loadDetailSpy.mockClear();
    emptyEl.dispatchEvent(new CustomEvent('action'));
    expect(loadDetailSpy).toHaveBeenCalledWith(84);
  });
});
