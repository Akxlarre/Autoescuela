import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DmsListContentComponent } from './dms-list-content.component';
import { ChileDatePipe } from '@shared/pipes/chile-date.pipe';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { StudentWithDocsRow } from '@core/models/ui/dms.model';

function makeStudentRow(overrides: Partial<StudentWithDocsRow> = {}): StudentWithDocsRow {
  return {
    studentId: 10,
    enrollmentId: 100,
    name: 'Pérez Gómez Juan',
    rut: '12.345.678-9',
    matriculaNumber: '#0001',
    branchName: 'Chillán',
    docCount: 2,
    ...overrides,
  };
}

describe('DmsListContentComponent (spec 0060-b T3.3)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  function mount(
    inputs: {
      studentsWithDocs?: StudentWithDocsRow[];
      loadError?: string | null;
      refreshFailed?: boolean;
      activeTab?: 'students' | 'school' | 'templates' | 'instructors';
    } = {},
  ) {
    TestBed.configureTestingModule({
      imports: [DmsListContentComponent],
      providers: [
        {
          provide: GsapAnimationsService,
          useValue: {
            animateBentoGrid: vi.fn(),
            animateHero: vi.fn(),
            addCardHover: vi.fn(),
          },
        },
      ],
    }).overrideComponent(DmsListContentComponent, {
      set: {
        imports: [ChileDatePipe],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });

    const fixture = TestBed.createComponent(DmsListContentComponent);
    const component = fixture.componentInstance;
    Object.defineProperty(component, 'basePath', { value: signal('/app/admin') });
    Object.defineProperty(component, 'studentsWithDocs', {
      value: signal(inputs.studentsWithDocs ?? []),
    });
    Object.defineProperty(component, 'loadError', { value: signal(inputs.loadError ?? null) });
    if (inputs.refreshFailed !== undefined) {
      Object.defineProperty(component, 'refreshFailed', {
        value: signal(inputs.refreshFailed),
      });
    }
    if (inputs.activeTab) {
      component.onTabChange(inputs.activeTab);
    }
    fixture.detectChanges();
    return { fixture, component };
  }

  it('Caso A: con loadError en recentDocs muestra app-empty-state con Reintentar', () => {
    const { fixture } = mount({ loadError: 'Error de red en DMS' });
    const retrySpy = vi.fn();
    fixture.componentInstance.retryRequested.subscribe(retrySpy);

    const emptyStates = Array.from(
      fixture.nativeElement.querySelectorAll('app-empty-state'),
    ) as any[];
    const withRetry = emptyStates.find(
      (el) => (el.actionLabel ?? el.getAttribute('actionLabel')) === 'Reintentar',
    );

    expect(emptyStates.length).toBeGreaterThan(0);
    expect(withRetry).toBeDefined();
    expect(
      emptyStates.some(
        (el) => (el.message ?? el.getAttribute('message')) === 'Error de red en DMS',
      ),
    ).toBe(true);

    withRetry?.dispatchEvent(new CustomEvent('action'));
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });

  it('Caso B: con datos cargados y refreshFailed true mantiene la tabla y muestra app-alert-card con Reintentar', () => {
    const { fixture, component } = mount({
      studentsWithDocs: [makeStudentRow()],
      refreshFailed: true,
    });
    const retrySpy = vi.fn();
    component.retryRequested.subscribe(retrySpy);

    const text = fixture.nativeElement.textContent as string;
    const alertCard = fixture.nativeElement.querySelector('app-alert-card');
    const retryBtn = fixture.nativeElement.querySelector(
      '[data-llm-action="reintentar-dms"]',
    ) as HTMLButtonElement | null;

    expect(component.filteredStudentsWithDocs().map((r) => r.name)).toEqual(['Pérez Gómez Juan']);
    expect(alertCard).not.toBeNull();
    expect(text).toContain('Los datos mostrados pueden no estar actualizados.');
    expect(retryBtn).not.toBeNull();
    retryBtn?.click();
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });
});
