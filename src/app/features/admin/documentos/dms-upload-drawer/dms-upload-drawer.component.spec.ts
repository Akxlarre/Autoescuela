import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DmsUploadDrawerComponent } from './dms-upload-drawer.component';
import { ConsentsFacade } from '@core/facades/consents.facade';
import { DmsFacade } from '@core/facades/dms.facade';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import type { StudentEnrollmentOption } from '@core/models/ui/dms.model';

describe('DmsUploadDrawerComponent', () => {
  let currentUploadMode: WritableSignal<'student' | 'school' | 'instructor'>;
  let studentDetail: WritableSignal<{
    name: string;
    rut: string;
    studentId: number;
    enrollmentId: number | null;
  } | null>;
  let studentDocs: WritableSignal<{ type: string }[]>;
  let studentEnrollmentOptions: WritableSignal<StudentEnrollmentOption[]>;
  let preselectedEnrollmentId: WritableSignal<number | null>;
  let instructorDetail: WritableSignal<{
    name: string;
    licenseNumber: string;
    instructorId: number;
  } | null>;
  let instructorDocs: WritableSignal<{ type: string }[]>;
  let loadStudentDocuments: ReturnType<typeof vi.fn>;
  let loadStudentEnrollmentOptions: ReturnType<typeof vi.fn>;
  let loadInstructorDocuments: ReturnType<typeof vi.fn>;
  let facadeMock: DmsFacade;

  beforeEach(async () => {
    currentUploadMode = signal('student');
    studentDetail = signal(null);
    studentDocs = signal([]);
    studentEnrollmentOptions = signal([]);
    preselectedEnrollmentId = signal(null);
    instructorDetail = signal(null);
    instructorDocs = signal([]);

    // Simula loadStudentDocuments()/loadInstructorDocuments() del facade real: pobla
    // studentDetail/studentDocs (o instructorDetail/instructorDocs) para el id pedido.
    loadStudentDocuments = vi.fn(async (studentId: number, enrollmentId?: number) => {
      studentDetail.set({
        name: 'Alumno Test',
        rut: '11.111.111-1',
        studentId,
        enrollmentId: enrollmentId ?? null,
      });
      studentDocs.set([{ type: 'contrato' }, { type: 'id_photo' }]);
    });
    // Por defecto simula un alumno con 1 sola matrícula (caso más común) — los tests que
    // necesitan 2+ matrículas la sobreescriben.
    loadStudentEnrollmentOptions = vi.fn(async () => {
      studentEnrollmentOptions.set([
        { enrollmentId: 100, label: 'Clase B · #0001', branchName: null },
      ]);
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
      studentEnrollmentOptions,
      preselectedEnrollmentId,
      instructorDetail,
      instructorDocs,
      preselectedStudentId: signal(null),
      preselectedInstructorId: signal(null),
      loadStudentDocuments,
      loadStudentEnrollmentOptions,
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
        // spec 0009-m: el drawer inyecta ConsentsFacade para el gate del Art. 16.
        // Se mockea para no arrastrar ToastService → MessageService de PrimeNG.
        {
          provide: ConsentsFacade,
          useValue: { recordMedicalCertificate: vi.fn().mockResolvedValue(true) },
        },
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

  it('filtra los tipos ya subidos cuando el alumno (1 sola matrícula) se selecciona desde el dropdown genérico', () => {
    const fixture = TestBed.createComponent(DmsUploadDrawerComponent);
    const component = fixture.componentInstance;
    TestBed.flushEffects();

    component.selectedStudentId.set(42);
    TestBed.flushEffects();

    expect(loadStudentEnrollmentOptions).toHaveBeenCalledWith(42);
    // 1 sola matrícula → auto-selección sin mostrar el segundo selector (AC4/AC-E1).
    expect(component.selectedEnrollmentId()).toBe(100);
    expect(component.showEnrollmentSelector()).toBe(false);
    expect(loadStudentDocuments).toHaveBeenCalledWith(42, 100);
    const values = component.currentDocTypes().map((t) => t.value);
    expect(values).not.toContain('contrato');
    expect(values).not.toContain('id_photo');
  });

  it('AC-E2: alumno con 2+ matrículas muestra el segundo selector y no carga documentos hasta elegir una', () => {
    loadStudentEnrollmentOptions.mockImplementation(async () => {
      studentEnrollmentOptions.set([
        { enrollmentId: 100, label: 'Clase B · #0001', branchName: 'Sede Centro' },
        { enrollmentId: 200, label: 'Clase B · #0002', branchName: 'Sede Norte' },
      ]);
    });

    const fixture = TestBed.createComponent(DmsUploadDrawerComponent);
    const component = fixture.componentInstance;
    TestBed.flushEffects();

    component.selectedStudentId.set(42);
    TestBed.flushEffects();

    expect(component.showEnrollmentSelector()).toBe(true);
    expect(component.selectedEnrollmentId()).toBeNull();
    expect(loadStudentDocuments).not.toHaveBeenCalled();

    component.selectedEnrollmentId.set(200);
    TestBed.flushEffects();

    expect(loadStudentDocuments).toHaveBeenCalledWith(42, 200);
  });

  it('AC3: con preselectedEnrollmentId, no muestra el segundo selector y usa ese id directo', () => {
    preselectedEnrollmentId.set(300);
    studentEnrollmentOptions.set([
      { enrollmentId: 100, label: 'Clase B · #0001', branchName: null },
      { enrollmentId: 300, label: 'Clase B · #0003', branchName: null },
    ]);

    const fixture = TestBed.createComponent(DmsUploadDrawerComponent);
    const component = fixture.componentInstance;
    TestBed.flushEffects();

    expect(component.showEnrollmentSelector()).toBe(false);
    expect(component.selectedEnrollmentId()).toBe(300);
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
    studentDetail.set({
      name: 'Alumno Test',
      rut: '11.111.111-1',
      studentId: 42,
      enrollmentId: 100,
    });
    studentDocs.set([{ type: 'contrato' }]);
    studentEnrollmentOptions.set([
      { enrollmentId: 100, label: 'Clase B · #0001', branchName: null },
    ]);

    const fixture = TestBed.createComponent(DmsUploadDrawerComponent);
    const component = fixture.componentInstance;
    component.selectedStudentId.set(42);
    component.selectedEnrollmentId.set(100);
    TestBed.flushEffects();

    expect(loadStudentDocuments).not.toHaveBeenCalled();
  });
});
