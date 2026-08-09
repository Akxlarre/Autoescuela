import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DmsUploadDrawerComponent } from './dms-upload-drawer.component';
import { DmsFacade } from '@core/facades/dms.facade';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

describe('DmsUploadDrawerComponent', () => {
  let currentUploadMode: WritableSignal<'student' | 'school' | 'instructor'>;
  let studentDetail: WritableSignal<{ name: string; rut: string; studentId: number } | null>;
  let studentDocs: WritableSignal<{ type: string }[]>;
  let instructorDetail: WritableSignal<{
    name: string;
    licenseNumber: string;
    instructorId: number;
  } | null>;
  let instructorDocs: WritableSignal<{ type: string }[]>;
  let loadStudentDocuments: ReturnType<typeof vi.fn>;
  let loadInstructorDocuments: ReturnType<typeof vi.fn>;
  let facadeMock: DmsFacade;

  beforeEach(async () => {
    currentUploadMode = signal('student');
    studentDetail = signal(null);
    studentDocs = signal([]);
    instructorDetail = signal(null);
    instructorDocs = signal([]);

    // Simula loadStudentDocuments()/loadInstructorDocuments() del facade real: pobla
    // studentDetail/studentDocs (o instructorDetail/instructorDocs) para el id pedido.
    loadStudentDocuments = vi.fn(async (id: number) => {
      studentDetail.set({ name: 'Alumno Test', rut: '11.111.111-1', studentId: id });
      studentDocs.set([{ type: 'contrato' }, { type: 'id_photo' }]);
    });
    loadInstructorDocuments = vi.fn(async (id: number) => {
      instructorDetail.set({ name: 'Instructor Test', licenseNumber: 'X1', instructorId: id });
      instructorDocs.set([{ type: 'licencia_conducir' }]);
    });

    facadeMock = {
      currentUploadMode,
      studentsWithDocs: signal([]),
      instructorsWithDocs: signal([]),
      studentDetail,
      studentDocs,
      instructorDetail,
      instructorDocs,
      preselectedStudentId: signal(null),
      preselectedInstructorId: signal(null),
      loadStudentDocuments,
      loadInstructorDocuments,
      showSuccess: vi.fn(),
      notifyUploadSaved: vi.fn(),
      closeDrawer: vi.fn(),
      uploadStudentDocument: vi.fn(),
      uploadInstructorDocument: vi.fn(),
      uploadSchoolDocument: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await TestBed.configureTestingModule({
      imports: [DmsUploadDrawerComponent],
      providers: [
        { provide: DmsFacade, useValue: facadeMock },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: unknown) => ({ message: String(e) }) },
        },
      ],
    })
      // El template real proyecta <app-async-btn> en el footer, que en este entorno
      // (Vitest/JIT) dispara un error NG0303/NG0950 pre-existente y no relacionado con este fix.
      // Se reemplaza por un template vacío: lo que se prueba acá son los `effect()` del
      // constructor y los `computed()` derivados, no el renderizado del DOM.
      .overrideComponent(DmsUploadDrawerComponent, { set: { template: '<div></div>' } })
      .compileComponents();
  });

  it('filtra los tipos ya subidos cuando el alumno se selecciona desde el dropdown genérico (sin preselectedId)', () => {
    const fixture = TestBed.createComponent(DmsUploadDrawerComponent);
    const component = fixture.componentInstance;
    TestBed.flushEffects();

    component.selectedStudentId.set(42);
    TestBed.flushEffects();

    expect(loadStudentDocuments).toHaveBeenCalledWith(42);
    const values = component.currentDocTypes().map((t) => t.value);
    expect(values).not.toContain('contrato');
    expect(values).not.toContain('id_photo');
  });

  it('filtra los tipos ya subidos de instructor cuando se selecciona desde el dropdown genérico', () => {
    currentUploadMode.set('instructor');
    const fixture = TestBed.createComponent(DmsUploadDrawerComponent);
    const component = fixture.componentInstance;
    TestBed.flushEffects();

    component.selectedInstructorId.set(7);
    TestBed.flushEffects();

    expect(loadInstructorDocuments).toHaveBeenCalledWith(7);
    const values = component.currentDocTypes().map((t) => t.value);
    expect(values).not.toContain('licencia_conducir');
  });

  it('no vuelve a cargar cuando el seleccionado ya coincide con la entidad cargada en el facade', () => {
    studentDetail.set({ name: 'Alumno Test', rut: '11.111.111-1', studentId: 42 });
    studentDocs.set([{ type: 'contrato' }]);

    const fixture = TestBed.createComponent(DmsUploadDrawerComponent);
    const component = fixture.componentInstance;
    component.selectedStudentId.set(42);
    TestBed.flushEffects();

    expect(loadStudentDocuments).not.toHaveBeenCalled();
  });
});
