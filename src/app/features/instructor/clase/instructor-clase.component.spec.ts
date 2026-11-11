import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { InstructorClaseComponent } from './instructor-clase.component';
import { InstructorClasesFacade } from '@core/facades/instructor-clases.facade';

describe('InstructorClaseComponent — errores de lectura (0060-b)', () => {
  it('muestra app-empty-state con detailError() y Reintentar llama reintentarDetail()', () => {
    const reintentarDetailSpy = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [InstructorClaseComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParams: of({ sessionId: '15' }) } },
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
            startClass: vi.fn(),
            showSuccess: vi.fn(),
            showError: vi.fn(),
          },
        },
      ],
    }).overrideComponent(InstructorClaseComponent, {
      set: { imports: [ReactiveFormsModule, LowerCasePipe], schemas: [NO_ERRORS_SCHEMA] },
    });

    const fixture = TestBed.createComponent(InstructorClaseComponent);
    fixture.detectChanges();

    const emptyEl = fixture.nativeElement.querySelector('app-empty-state') as any;
    expect(emptyEl).not.toBeNull();
    expect(emptyEl.message).toBe('No se pudo cargar el detalle de la clase.');
    expect(emptyEl.getAttribute('actionLabel')).toBe('Reintentar');

    emptyEl.dispatchEvent(new CustomEvent('action'));
    expect(reintentarDetailSpy).toHaveBeenCalledTimes(1);
  });
});
