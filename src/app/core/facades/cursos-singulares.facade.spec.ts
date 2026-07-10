import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CursosSingularesFacade, mapCursoDto } from './cursos-singulares.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { ToastService } from '@core/services/ui/toast.service';
import type {
  SingularPaymentForm,
  SingularPersonalDataForm,
} from '@core/models/ui/cursos-singulares.model';

/**
 * fix-015 — CursosSingularesFacade: validación de datos personales,
 * sanitización de errores de BD, pre-carga completa del alumno existente
 * y check de duplicado antes de escribir.
 * fix-016 — finanzas reales (mapCursoDto), cupos y descuentos persistidos.
 */
describe('CursosSingularesFacade', () => {
  let facade: CursosSingularesFacade;
  let supabaseSpy: any;
  let toastSpy: any;
  let notificationsSpy: any;

  /** Cola FIFO de respuestas `{ data, error, count }` — cada query terminal consume una. */
  let queue: Array<{ data?: any; error?: any; count?: number }>;
  /** Registro de llamadas a `from(tabla)` con su chain para inspeccionar payloads. */
  let fromCalls: Array<{ table: string; chain: any }>;

  function nextResult(): Promise<any> {
    return Promise.resolve(queue.shift() ?? { data: null, error: null });
  }

  function buildChain(): any {
    const chain: any = {};
    for (const m of ['select', 'eq', 'order', 'insert', 'update']) {
      chain[m] = vi.fn(() => chain);
    }
    chain.maybeSingle = vi.fn(() => nextResult());
    chain.single = vi.fn(() => nextResult());
    chain.then = (res: any, rej: any) => nextResult().then(res, rej);
    return chain;
  }

  const pagoEfectivo: SingularPaymentForm = {
    amountPaid: 100000,
    paymentMethod: 'efectivo',
    paymentStatus: 'paid',
    discountAmount: 0,
    discountReason: null,
  };

  const validForm: SingularPersonalDataForm = {
    rut: '12345678-5',
    firstNames: 'María José',
    paternalLastName: 'Soto',
    maternalLastName: '',
    email: 'maria@test.cl',
    phone: '+56911112222',
    birthDate: '1990-05-10',
    gender: 'F',
    address: '',
  };

  beforeEach(() => {
    queue = [];
    fromCalls = [];
    supabaseSpy = {
      client: {
        from: vi.fn((table: string) => {
          const chain = buildChain();
          fromCalls.push({ table, chain });
          return chain;
        }),
      },
    };
    toastSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    notificationsSpy = { notifyUsers: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      providers: [
        CursosSingularesFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: BranchFacade, useValue: { selectedBranchId: signal<number | null>(1) } },
        { provide: AuthFacade, useValue: { currentUser: signal({ dbId: 9, role: 'admin' }) } },
        { provide: ToastService, useValue: toastSpy },
        { provide: NotificationsFacade, useValue: notificationsSpy },
      ],
    });

    facade = TestBed.inject(CursosSingularesFacade);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  // ── AC4: validación de datos personales ────────────────────────────────────

  describe('savePersonalData', () => {
    it('rechaza el avance sin fecha de nacimiento (NOT NULL en BD)', () => {
      const ok = facade.savePersonalData({ ...validForm, birthDate: '' }, 1);
      expect(ok).toBe(false);
      expect(facade.error()).toContain('fecha de nacimiento');
      expect(facade.wizardStep()).toBe(1);
    });

    it('rechaza alumnos menores de 17 años (CHECK de BD) con mensaje claro', () => {
      const hoy = new Date();
      const birthDate = `${hoy.getFullYear() - 15}-01-01`;
      const ok = facade.savePersonalData({ ...validForm, birthDate }, 1);
      expect(ok).toBe(false);
      expect(facade.error()).toContain('17 años');
    });

    it('con datos válidos avanza al paso 2 sin tocar la BD', () => {
      const ok = facade.savePersonalData(validForm, 1);
      expect(ok).toBe(true);
      expect(facade.wizardStep()).toBe(2);
      expect(facade.error()).toBeNull();
      expect(supabaseSpy.client.from).not.toHaveBeenCalled();
    });
  });

  // ── AC3: pre-carga completa del alumno existente ───────────────────────────

  describe('searchByRut', () => {
    it('pre-carga TODOS los datos del alumno existente (incl. birth_date, gender, address)', async () => {
      queue.push(
        {
          data: {
            id: 1,
            first_names: 'Pedro',
            paternal_last_name: 'Rojas',
            maternal_last_name: 'Lara',
            email: 'pedro@test.cl',
            phone: '+5691234',
          },
        },
        { data: { id: 2, birth_date: '1988-03-20', gender: 'M', address: 'Calle Falsa 123' } },
      );

      await facade.searchByRut('12.345.678-5');

      const res = facade.studentSearch();
      expect(res).not.toBeNull();
      expect(res!.birthDate).toBe('1988-03-20');
      expect(res!.gender).toBe('M');
      expect(res!.address).toBe('Calle Falsa 123');
      expect(res!.maternalLastName).toBe('Lara');
      expect(facade.studentNotFound()).toBe(false);
    });

    it('RUT inexistente setea studentNotFound sin error', async () => {
      queue.push({ data: null });
      await facade.searchByRut('11.111.111-1');
      expect(facade.studentNotFound()).toBe(true);
      expect(facade.studentSearch()).toBeNull();
      expect(facade.error()).toBeNull();
    });
  });

  // ── AC5: duplicado se verifica ANTES de escribir ───────────────────────────

  describe('inscribirAlumno', () => {
    it('si el alumno ya está inscrito, no ejecuta ninguna escritura', async () => {
      facade.savePersonalData(validForm, 1);
      // isAlreadyEnrolled: user → student → enrollment existente
      queue.push({ data: { id: 1 } }, { data: { id: 2 } }, { data: { id: 77 } });

      const ok = await facade.inscribirAlumno(10, pagoEfectivo);

      expect(ok).toBe(false);
      expect(facade.error()).toContain('ya está inscrito');
      // Solo 3 lookups read-only — sin update/insert
      expect(fromCalls.length).toBe(3);
      for (const call of fromCalls) {
        expect(call.chain.update).not.toHaveBeenCalled();
        expect(call.chain.insert).not.toHaveBeenCalled();
      }
    });

    it('fix-016 AC5: con cupos llenos rechaza la inscripción sin escribir', async () => {
      facade.savePersonalData(validForm, 1);
      queue.push(
        { data: { id: 1 } }, // isAlreadyEnrolled: user
        { data: { id: 2 } }, // isAlreadyEnrolled: student
        { data: null }, // sin inscripción previa
        { data: { max_students: 10 } }, // hasAvailableSeats: curso
        { count: 10, error: null }, // hasAvailableSeats: ya hay 10 inscritos
      );

      const ok = await facade.inscribirAlumno(10, pagoEfectivo);

      expect(ok).toBe(false);
      expect(facade.error()).toContain('cupos');
      for (const call of fromCalls) {
        expect(call.chain.update).not.toHaveBeenCalled();
        expect(call.chain.insert).not.toHaveBeenCalled();
      }
    });

    it('AC3: el UPDATE del alumno existente nunca incluye campos vacíos (no pisa datos)', async () => {
      // Formulario sin address — el UPDATE no debe enviarlo
      facade.savePersonalData(validForm, 1);
      queue.push(
        { data: { id: 1 } }, // isAlreadyEnrolled: user
        { data: { id: 2 } }, // isAlreadyEnrolled: student
        { data: null }, // isAlreadyEnrolled: sin inscripción previa
        { data: { max_students: 10 } }, // hasAvailableSeats: curso
        { count: 1, error: null }, // hasAvailableSeats: hay cupo
        { data: { id: 1 } }, // upsertUser: existente
        { error: null }, // upsertUser: update OK
        { data: { id: 2 } }, // upsertStudent: existente
        { error: null }, // upsertStudent: update OK
        { error: null }, // insert inscripción OK
        { data: [] }, // loadInscriptos
        { data: [] }, // refreshSilently → fetchCursos
      );

      const ok = await facade.inscribirAlumno(10, pagoEfectivo);

      expect(ok).toBe(true);
      const studentUpdate = fromCalls.filter(
        (c) => c.table === 'students' && c.chain.update.mock.calls.length > 0,
      );
      expect(studentUpdate.length).toBe(1);
      const payload = studentUpdate[0].chain.update.mock.calls[0][0];
      expect(payload['birth_date']).toBe('1990-05-10');
      expect(payload['gender']).toBe('F');
      expect('address' in payload).toBe(false);
      expect('status' in payload).toBe(false);
      expect(toastSpy.success).toHaveBeenCalled();
    });

    it('fix-016 AC1: el descuento se persiste aunque el pago quede pendiente', async () => {
      facade.savePersonalData(validForm, 1);
      queue.push(
        { data: { id: 1 } },
        { data: { id: 2 } },
        { data: null },
        { data: { max_students: 10 } },
        { count: 1, error: null },
        { data: { id: 1 } },
        { error: null },
        { data: { id: 2 } },
        { error: null },
        { error: null }, // insert inscripción
        { data: [] },
        { data: [] },
      );

      const ok = await facade.inscribirAlumno(10, {
        amountPaid: 0,
        paymentMethod: 'pendiente',
        paymentStatus: 'pending',
        discountAmount: 20000,
        discountReason: 'Convenio empresa',
      });

      expect(ok).toBe(true);
      const enrollInsert = fromCalls.filter(
        (c) => c.table === 'standalone_course_enrollments' && c.chain.insert.mock.calls.length > 0,
      );
      expect(enrollInsert.length).toBe(1);
      const payload = enrollInsert[0].chain.insert.mock.calls[0][0];
      expect(payload['discount_amount']).toBe(20000);
      expect(payload['discount_reason']).toBe('Convenio empresa');
      expect(payload['paid_at']).toBeNull(); // pendiente → sin fecha de cobro
    });

    it('AC2: un error crudo de PostgreSQL nunca llega al signal de error', async () => {
      facade.savePersonalData(validForm, 1);
      const rawPgError = {
        code: '23502',
        message:
          'null value in column "birth_date" of relation "students" violates not-null constraint',
      };
      queue.push(
        { data: { id: 1 } }, // isAlreadyEnrolled: user
        { data: { id: 2 } }, // isAlreadyEnrolled: student
        { data: null }, // sin inscripción previa
        { data: { max_students: 10 } }, // hasAvailableSeats: curso
        { count: 1, error: null }, // hasAvailableSeats: hay cupo
        { data: { id: 1 } }, // upsertUser: existente
        { error: rawPgError }, // upsertUser: update FALLA
      );

      const ok = await facade.inscribirAlumno(10, pagoEfectivo);

      expect(ok).toBe(false);
      const msg = facade.error() ?? '';
      expect(msg).not.toContain('birth_date');
      expect(msg).not.toContain('constraint');
      expect(msg).not.toContain('relation');
      expect(msg.length).toBeGreaterThan(0);
    });
  });

  // ── AC2: sanitización en acciones de curso ─────────────────────────────────

  describe('crearCurso', () => {
    it('error de BD se sanitiza (sin columnas ni constraints)', async () => {
      queue.push({
        error: { code: '23514', message: 'check constraint "standalone_courses_price" violated' },
      });

      const ok = await facade.crearCurso({
        nombre: 'Test',
        tipo: 'particular',
        billingType: 'boleta',
        precio: 100000,
        duracionHoras: 10,
        cupos: 10,
        inicio: '2026-07-01',
        branchId: 1,
      });

      expect(ok).toBe(false);
      const msg = facade.error() ?? '';
      expect(msg).not.toContain('standalone_courses');
      expect(msg).not.toContain('constraint');
    });

    it('fix-016 AC4: sin sede no escribe y pide seleccionarla', async () => {
      const ok = await facade.crearCurso({
        nombre: 'Test',
        tipo: 'particular',
        billingType: 'boleta',
        precio: 100000,
        duracionHoras: 10,
        cupos: 10,
        inicio: '2026-07-01',
        branchId: 0,
      });

      expect(ok).toBe(false);
      expect(facade.error()).toContain('sede');
      expect(supabaseSpy.client.from).not.toHaveBeenCalled();
    });

    it('fix-016 AC4: persiste branch_id y registered_by', async () => {
      queue.push({ error: null }, { data: [] }); // insert + refreshSilently

      const ok = await facade.crearCurso({
        nombre: 'Grúa Horquilla',
        tipo: 'particular',
        billingType: 'boleta',
        precio: 250000,
        duracionHoras: 40,
        cupos: 12,
        inicio: '2026-08-01',
        branchId: 2,
      });

      expect(ok).toBe(true);
      const insert = fromCalls.find(
        (c) => c.table === 'standalone_courses' && c.chain.insert.mock.calls.length > 0,
      );
      expect(insert).toBeDefined();
      const payload = insert!.chain.insert.mock.calls[0][0];
      expect(payload['branch_id']).toBe(2);
      expect(payload['registered_by']).toBe(9);
    });
  });

  // ── spec 0025 (T2.3): notificación al alumno tras marcar el curso pagado ──
  describe('marcarEnrollmentPagado — notificación al alumno (spec 0025, AC1, AC-E1)', () => {
    beforeEach(() => {
      (facade as any)._selectedCurso.set({ id: 1, precio: 100000 } as any);
    });

    it('notifica al alumno resolviendo standalone_course_enrollments → students.user_id', async () => {
      queue.push({ data: { discount_amount: 0 }, error: null }); // select discount_amount
      queue.push({ data: null, error: null }); // update payment_status
      queue.push({ data: { students: { user_id: 88 } }, error: null }); // resolver student user_id
      queue.push({ data: [], error: null }); // loadInscriptos
      queue.push({ data: [], error: null }); // refreshSilently

      const ok = await facade.marcarEnrollmentPagado(10);

      expect(ok).toBe(true);
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
        [88],
        expect.objectContaining({ referenceType: 'payment' }),
      );
    });

    it('monto $0 (descuento total) no dispara notificación (AC-E1)', async () => {
      queue.push({ data: { discount_amount: 100000 }, error: null }); // descuento = precio completo
      queue.push({ data: null, error: null }); // update payment_status
      queue.push({ data: [], error: null }); // loadInscriptos
      queue.push({ data: [], error: null }); // refreshSilently

      const ok = await facade.marcarEnrollmentPagado(10);

      expect(ok).toBe(true);
      expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
    });

    it('un fallo en notifyUsers no revierte el registro del pago', async () => {
      notificationsSpy.notifyUsers.mockRejectedValue(new Error('network error'));
      queue.push({ data: { discount_amount: 0 }, error: null });
      queue.push({ data: null, error: null });
      queue.push({ data: { students: { user_id: 88 } }, error: null });
      queue.push({ data: [], error: null });
      queue.push({ data: [], error: null });

      const ok = await facade.marcarEnrollmentPagado(10);

      expect(ok).toBe(true);
    });
  });

  // ── fix-016 AC2: finanzas reales en mapCursoDto (Functional Core) ──────────

  describe('mapCursoDto', () => {
    const baseDto = {
      id: 1,
      name: 'Retroexcavadora',
      type: 'particular',
      billing_type: 'factura',
      base_price: 220000,
      duration_hours: 65,
      max_students: 15,
      start_date: '2026-04-16',
      status: null,
      branch_id: 1,
      created_at: '2026-04-01T00:00:00Z',
    };

    it('ingresoCobrado = Σ amount_paid; porCobrar respeta descuentos', () => {
      const row = mapCursoDto({
        ...baseDto,
        standalone_course_enrollments: [
          { amount_paid: 220000, payment_status: 'paid', discount_amount: 0 },
          { amount_paid: 0, payment_status: 'pending', discount_amount: 20000 },
        ],
      });

      expect(row.inscritos).toBe(2);
      expect(row.ingresoCobrado).toBe(220000); // solo lo pagado
      expect(row.porCobrar).toBe(200000); // 220.000 − 20.000 de descuento
    });

    it('sin inscritos: cobrado y por cobrar en 0', () => {
      const row = mapCursoDto({ ...baseDto, standalone_course_enrollments: [] });
      expect(row.inscritos).toBe(0);
      expect(row.ingresoCobrado).toBe(0);
      expect(row.porCobrar).toBe(0);
    });
  });
});
