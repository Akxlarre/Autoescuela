import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LibroDeClasesFacade } from './libro-de-clases.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

/** Respuesta por tabla; single/maybeSingle pueden diferir de la respuesta awaitable. */
type TableConfig = {
  data?: unknown;
  error?: unknown;
  single?: { data: unknown; error: unknown };
  maybeSingle?: { data: unknown; error: unknown };
};

function createMockSupabase(tables: Record<string, TableConfig>) {
  const builders = new Map<string, any>();
  const from = vi.fn().mockImplementation((table: string) => {
    if (!builders.has(table)) {
      const cfg = tables[table] ?? {};
      const listRes = { data: cfg.data ?? [], error: cfg.error ?? null };
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(cfg.single ?? listRes),
        maybeSingle: vi.fn().mockResolvedValue(cfg.maybeSingle ?? { data: null, error: null }),
        then: (resolve: any, reject: any) => Promise.resolve(listRes).then(resolve, reject),
      };
      builders.set(table, builder);
    }
    return builders.get(table);
  });
  return {
    client: {
      from,
      functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    },
    _builders: builders,
  };
}

function setup(tables: Record<string, TableConfig> = {}) {
  const mockSupabase = createMockSupabase(tables);
  const mockToast = { success: vi.fn(), error: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: mockSupabase },
      {
        provide: AuthFacade,
        useValue: {
          currentUser: vi.fn(() => ({ role: 'admin', branchId: 1, canAccessBothBranches: false })),
        },
      },
      { provide: BranchFacade, useValue: { selectedBranchId: vi.fn(() => null) } },
      { provide: ToastService, useValue: mockToast },
      { provide: ErrorSanitizerService, useValue: { sanitize: vi.fn((e: Error) => e) } },
    ],
  });
  return { facade: TestBed.inject(LibroDeClasesFacade), mockSupabase, mockToast };
}

/** Set de tablas para la cascada completa de un curso con datos. */
function cursoCompleto(): Record<string, TableConfig> {
  return {
    professional_promotions: { data: [], error: null },
    promotion_courses: {
      data: [{ id: 5, courses: { code: 'PROF-A4-01', name: 'Camiones', license_class: 'A4' } }],
      single: {
        data: {
          id: 5,
          code: 'P26.4',
          courses: { name: 'Camiones', code: 'PROF-A4-01', license_class: 'A4' },
          professional_promotions: {
            name: 'Otoño 2026',
            code: 'P26',
            start_date: '2026-03-01',
            end_date: '2026-06-30',
            status: 'in_progress',
            branches: { name: 'Centro', address: 'Calle 1' },
          },
        },
        error: null,
      },
    },
    class_book: { maybeSingle: { data: null, error: null } },
    enrollments: {
      data: [
        {
          id: 20,
          students: {
            users: {
              first_names: 'Zoe',
              paternal_last_name: 'Zúñiga',
              maternal_last_name: null,
              rut: '2-7',
              phone: null,
            },
          },
        },
        {
          id: 10,
          students: {
            users: {
              first_names: 'Ana',
              paternal_last_name: 'Araya',
              maternal_last_name: 'Soto',
              rut: '1-9',
              phone: '+56 9',
            },
          },
        },
      ],
    },
    promotion_course_lecturers: {
      data: [
        {
          lecturer_id: 1,
          role: 'theory',
          lecturers: { first_names: 'Teo', paternal_last_name: 'Torres' },
        },
        {
          lecturer_id: 2,
          role: 'practice',
          lecturers: { first_names: 'Pau', paternal_last_name: 'Prat' },
        },
      ],
    },
    professional_theory_sessions: {
      data: [
        { id: 1, date: '2026-07-06', status: 'completed' },
        { id: 2, date: '2026-07-07', status: 'cancelled' },
      ],
    },
    professional_practice_sessions: { data: [] },
    professional_theory_attendance: {
      data: [{ theory_session_prof_id: 1, enrollment_id: 10, status: 'present' }],
    },
    professional_practice_attendance: { data: [] },
    professional_weekly_signatures: {
      data: [{ enrollment_id: 10, week_start_date: '2026-07-06', signed_at: '2026-07-06T10:00' }],
    },
    professional_module_grades: {
      data: [
        { enrollment_id: 10, module_number: 1, grade: 80, passed: true, status: 'graded' },
        { enrollment_id: 10, module_number: 2, grade: 90, passed: true, status: 'graded' },
      ],
    },
  };
}

describe('LibroDeClasesFacade', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('initialize auto-selecciona la promoción in_progress (no la primera de la lista)', async () => {
    const { facade } = setup({
      professional_promotions: {
        data: [
          { id: 1, name: 'Planificada', code: 'P1', status: 'planned' },
          { id: 2, name: null, code: 'P2', status: 'in_progress' },
        ],
      },
      promotion_courses: { data: [] }, // corta la cascada
    });
    await facade.initialize();
    expect(facade.selectedPromocionId()).toBe(2);
    // name null → cae al code
    expect(facade.promociones().find((p) => p.id === 2)?.name).toBe('P2');
  });

  describe('cascada selectPromocion → selectCurso → secciones', () => {
    it('extrae el código de licencia del code del curso (PROF-A4-01 → A4)', async () => {
      const { facade } = setup(cursoCompleto());
      await facade.selectPromocion(1);
      expect(facade.cursos()[0].courseCode).toBe('A4');
      expect(facade.selectedCursoId()).toBe(5); // auto-selecciona el primer curso
    });

    it('cabecera consolidada: promoción + curso + sede, sin libro → classBookId null', async () => {
      const { facade } = setup(cursoCompleto());
      await facade.selectPromocion(1);
      const cab = facade.cabecera()!;
      expect(cab.promotionName).toBe('Otoño 2026');
      expect(cab.licenseClass).toBe('A4');
      expect(cab.branchName).toBe('Centro');
      expect(cab.classBookId).toBeNull();
      expect(cab.senceCode).toBe('');
      expect(cab.bookId).toBe('P26.4');
    });

    it('alumnos ordenados alfabéticamente y renumerados 1..N', async () => {
      const { facade } = setup(cursoCompleto());
      await facade.selectPromocion(1);
      const alumnos = facade.alumnos();
      expect(alumnos.map((a) => a.nombre)).toEqual(['Araya Soto Ana', 'Zúñiga Zoe']);
      expect(alumnos.map((a) => a.numero)).toEqual([1, 2]);
    });

    it('módulo 6 (Conducción) prefiere relator practice; el resto theory', async () => {
      const { facade } = setup(cursoCompleto());
      await facade.selectPromocion(1);
      const prof = facade.profesores();
      expect(prof[0].lecturerName).toBe('Teo Torres'); // módulo 1 → theory
      expect(prof[5].lecturerName).toBe('Pau Prat'); // módulo 6 → practice
    });

    it('evaluaciones: promedio de módulos con nota y aprobado ≥ 75; sin notas → null', async () => {
      const { facade } = setup(cursoCompleto());
      await facade.selectPromocion(1);
      const [ana, zoe] = facade.evaluaciones();
      expect(ana.notaFinal).toBe(85); // (80+90)/2
      expect(ana.aprobado).toBe(true);
      expect(zoe.notaFinal).toBeNull();
      expect(zoe.aprobado).toBe(false);
    });

    it('asistencia semanal: agrupa por semana Lun–Sáb, marca presente y firma', async () => {
      const { facade } = setup(cursoCompleto());
      await facade.selectPromocion(1);
      const semanas = facade.asistenciaSemanal();
      expect(semanas).toHaveLength(1); // 06 y 07 jul caen en la misma semana
      expect(semanas[0].dias).toHaveLength(6);
      const ana = semanas[0].alumnos.find((a) => a.enrollmentId === 10)!;
      expect(ana.asistenciaDias[0]).toBe('present'); // lunes 06
      expect(ana.firmaSemanal).toBe(true);
      const zoe = semanas[0].alumnos.find((a) => a.enrollmentId === 20)!;
      expect(zoe.firmaSemanal).toBe(false);
    });

    it('calendario excluye sesiones canceladas y renumera', async () => {
      const { facade } = setup(cursoCompleto());
      await facade.selectPromocion(1);
      expect(facade.calendario()).toHaveLength(1);
      expect(facade.calendario()[0].numero).toBe(1);
    });
  });

  describe('saveClassBookFields', () => {
    it('sin libro existente → INSERT con period=código de promoción y actualiza cabecera', async () => {
      const tables = cursoCompleto();
      tables['class_book'] = {
        maybeSingle: { data: null, error: null },
        single: { data: { id: 55 }, error: null },
      };
      const { facade, mockSupabase, mockToast } = setup(tables);
      await facade.selectPromocion(1);
      const ok = await facade.saveClassBookFields('SENCE-1', 'Lun a Vie 9:00');
      expect(ok).toBe(true);
      const insertMock = mockSupabase._builders.get('class_book').insert;
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ period: 'P26', promotion_course_id: 5, status: 'draft' }),
      );
      expect(facade.cabecera()?.classBookId).toBe(55);
      expect(facade.cabecera()?.senceCode).toBe('SENCE-1');
      expect(mockToast.success).toHaveBeenCalled();
    });

    it('con libro existente → UPDATE por id y cabecera local sincronizada', async () => {
      const tables = cursoCompleto();
      tables['class_book'] = {
        maybeSingle: { data: { id: 7, sence_code: 'OLD', horario: 'x' }, error: null },
      };
      const { facade, mockSupabase } = setup(tables);
      await facade.selectPromocion(1);
      const ok = await facade.saveClassBookFields('NEW', 'Sáb 10:00');
      expect(ok).toBe(true);
      const updateMock = mockSupabase._builders.get('class_book').update;
      expect(updateMock).toHaveBeenCalledWith({ sence_code: 'NEW', horario: 'Sáb 10:00' });
      expect(facade.cabecera()?.classBookId).toBe(7);
      expect(facade.cabecera()?.senceCode).toBe('NEW');
    });

    it('sin curso seleccionado → false sin tocar la BD', async () => {
      const { facade, mockSupabase } = setup();
      const ok = await facade.saveClassBookFields('S', 'H');
      expect(ok).toBe(false);
      expect(mockSupabase.client.from).not.toHaveBeenCalledWith('class_book');
    });
  });

  describe('exportPdf', () => {
    it('respuesta sin pdfUrl → toast de error y null (no intenta descargar)', async () => {
      const tables = cursoCompleto();
      const { facade, mockSupabase, mockToast } = setup(tables);
      await facade.selectPromocion(1);
      mockSupabase.client.functions.invoke.mockResolvedValue({
        data: { error: 'faltan datos' },
        error: null,
      });
      const url = await facade.exportPdf();
      expect(url).toBeNull();
      expect(mockToast.error).toHaveBeenCalled();
      expect(facade.isExporting()).toBe(false);
    });

    it('sin curso seleccionado → null inmediato', async () => {
      const { facade } = setup();
      expect(await facade.exportPdf()).toBeNull();
    });
  });

  it('reset() limpia todo el estado y permite re-inicializar', async () => {
    const { facade } = setup(cursoCompleto());
    await facade.selectPromocion(1);
    facade.reset();
    expect(facade.cabecera()).toBeNull();
    expect(facade.cursos()).toEqual([]);
    expect(facade.selectedCursoId()).toBeNull();
    expect(facade.alumnos()).toEqual([]);
  });
});
