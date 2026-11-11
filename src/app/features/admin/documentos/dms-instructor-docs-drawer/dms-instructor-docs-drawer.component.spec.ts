import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DmsInstructorDocsDrawerComponent } from './dms-instructor-docs-drawer.component';
import { DmsFacade } from '@core/facades/dms.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { ChileDatePipe } from '@shared/pipes/chile-date.pipe';

describe('DmsInstructorDocsDrawerComponent (spec 0060-b T3.3)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('con instructorDocsError muestra estado de error con Reintentar en vez de "Sin documentos"', () => {
    const loadInstructorDocuments = vi.fn().mockResolvedValue(undefined);
    const facadeMock = {
      instructorDetail: signal({
        name: 'Carlos Muñoz',
        licenseNumber: 'A1-999',
        instructorId: 7,
      }),
      instructorDocs: signal([]),
      instructorDocsLoading: signal(false),
      instructorDocsError: signal<string | null>('Error al leer instructor'),
      openUploadInstructorDocDrawer: vi.fn(),
      openDocPreview: vi.fn(),
      deleteInstructorDocument: vi.fn(),
      loadInstructorDocuments,
    };

    TestBed.configureTestingModule({
      imports: [DmsInstructorDocsDrawerComponent],
      providers: [
        { provide: DmsFacade, useValue: facadeMock },
        { provide: AuthFacade, useValue: { currentUser: signal({ role: 'admin' }) } },
      ],
    }).overrideComponent(DmsInstructorDocsDrawerComponent, {
      set: {
        imports: [ChileDatePipe],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });

    const fixture = TestBed.createComponent(DmsInstructorDocsDrawerComponent);
    fixture.detectChanges();

    const emptyEl = fixture.nativeElement.querySelector('app-empty-state') as any;
    expect(emptyEl).not.toBeNull();
    expect(emptyEl.getAttribute('message')).toBe('No se pudieron cargar los documentos');
    expect(emptyEl.subtitle ?? emptyEl.getAttribute('subtitle')).toBe('Error al leer instructor');
    expect(emptyEl.getAttribute('actionLabel')).toBe('Reintentar');

    emptyEl.dispatchEvent(new CustomEvent('action'));
    expect(loadInstructorDocuments).toHaveBeenCalledWith(7);
  });
});
