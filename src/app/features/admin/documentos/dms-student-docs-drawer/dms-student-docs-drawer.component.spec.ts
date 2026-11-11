import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DmsStudentDocsDrawerComponent } from './dms-student-docs-drawer.component';
import { DmsFacade } from '@core/facades/dms.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { ChileDatePipe } from '@shared/pipes/chile-date.pipe';

describe('DmsStudentDocsDrawerComponent (spec 0060-b T3.3)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('con studentDocsError muestra estado de error con Reintentar en vez de "Sin documentos"', () => {
    const loadStudentDocuments = vi.fn().mockResolvedValue(undefined);
    const facadeMock = {
      studentsWithDocs: signal([]),
      studentDetail: signal({
        name: 'Juan Pérez',
        rut: '12.345.678-9',
        studentId: 42,
        enrollmentId: 100,
      }),
      studentDocs: signal([]),
      studentDocsLoading: signal(false),
      studentDocsError: signal<string | null>('Falla de conexión'),
      openUploadStudentDocDrawer: vi.fn(),
      openDocument: vi.fn(),
      openDocPreview: vi.fn(),
      deleteStudentDocument: vi.fn(),
      replaceStudentDocument: vi.fn(),
      showSuccess: vi.fn(),
      showError: vi.fn(),
      confirm: vi.fn(),
      loadStudentDocuments,
    };

    TestBed.configureTestingModule({
      imports: [DmsStudentDocsDrawerComponent],
      providers: [
        { provide: DmsFacade, useValue: facadeMock },
        { provide: AuthFacade, useValue: { currentUser: signal({ role: 'admin' }) } },
      ],
    }).overrideComponent(DmsStudentDocsDrawerComponent, {
      set: {
        imports: [ChileDatePipe],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });

    const fixture = TestBed.createComponent(DmsStudentDocsDrawerComponent);
    fixture.detectChanges();

    const emptyEl = fixture.nativeElement.querySelector('app-empty-state') as any;
    expect(emptyEl).not.toBeNull();
    expect(emptyEl.getAttribute('message')).toBe('No se pudieron cargar los documentos');
    expect(emptyEl.subtitle ?? emptyEl.getAttribute('subtitle')).toBe('Falla de conexión');
    expect(emptyEl.getAttribute('actionLabel')).toBe('Reintentar');

    emptyEl.dispatchEvent(new CustomEvent('action'));
    expect(loadStudentDocuments).toHaveBeenCalledWith(42, 100);
  });
});
