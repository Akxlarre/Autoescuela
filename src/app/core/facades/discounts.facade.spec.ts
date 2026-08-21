import { TestBed } from '@angular/core/testing';
import { DiscountsFacade } from './discounts.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

/** Query builder fake: soporta el chaining de Supabase y es thenable como el real. */
function makeBuilder(result: { data: any; error: any }): any {
  const b: any = {};
  b.select = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.order = vi.fn(() => Promise.resolve(result));
  b.insert = vi.fn(() => Promise.resolve(result));
  b.update = vi.fn(() => b);
  b.then = (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject);
  return b;
}

describe('DiscountsFacade', () => {
  let facade: DiscountsFacade;
  let supabaseSpy: any;
  let toastSpy: any;
  let fromMock: any;

  const rows = [
    {
      id: 1,
      name: 'Descuento Referido',
      discount_type: 'percentage',
      value: 10,
      valid_from: '2026-01-01',
      valid_until: null,
      applicable_to: 'class_b',
      status: 'active',
      branch_id: null,
      course_id: null,
      branches: null,
      courses: null,
    },
    {
      id: 2,
      name: 'Promo A2',
      discount_type: 'fixed_amount',
      value: 20000,
      valid_from: '2025-01-01',
      valid_until: '2025-06-01',
      applicable_to: 'professional',
      status: 'inactive',
      branch_id: 3,
      course_id: 7,
      branches: { name: 'Autoescuela Chillán' },
      courses: { name: 'Profesional A2' },
    },
  ];

  beforeEach(() => {
    toastSpy = { success: vi.fn(), error: vi.fn() };
    fromMock = vi.fn(() => makeBuilder({ data: rows, error: null }));
    supabaseSpy = { client: { from: fromMock } };

    TestBed.configureTestingModule({
      providers: [
        DiscountsFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
    });

    facade = TestBed.inject(DiscountsFacade);
  });

  it('carga descuentos y mapea DTO snake_case a UI camelCase, incluyendo sede y curso puntual', async () => {
    await facade.loadDiscounts();

    expect(facade.discounts()).toEqual([
      {
        id: 1,
        name: 'Descuento Referido',
        discountType: 'percentage',
        value: 10,
        validFrom: '2026-01-01',
        validUntil: null,
        applicableTo: 'class_b',
        status: 'active',
        branchId: null,
        branchName: null,
        courseId: null,
        courseName: null,
      },
      {
        id: 2,
        name: 'Promo A2',
        discountType: 'fixed_amount',
        value: 20000,
        validFrom: '2025-01-01',
        validUntil: '2025-06-01',
        applicableTo: 'professional',
        status: 'inactive',
        branchId: 3,
        branchName: 'Autoescuela Chillán',
        courseId: 7,
        courseName: 'Profesional A2',
      },
    ]);
  });

  it('incluye descuentos inactivos en la lista de administración (a diferencia del consumo en matrícula)', async () => {
    await facade.loadDiscounts();

    expect(facade.discounts().some((d) => d.status === 'inactive')).toBe(true);
  });

  it('createDiscount inserta el payload mapeado a snake_case (incl. branch_id/course_id) y refresca la lista', async () => {
    const insertBuilder = makeBuilder({ data: null, error: null });
    fromMock
      .mockReturnValueOnce(insertBuilder)
      .mockReturnValueOnce(makeBuilder({ data: rows, error: null }));

    const success = await facade.createDiscount({
      name: 'Nuevo Descuento',
      discountType: 'percentage',
      value: 15,
      validFrom: '2026-08-21',
      validUntil: null,
      applicableTo: 'professional',
      branchId: 3,
      courseId: 7,
    });

    expect(success).toBe(true);
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Nuevo Descuento',
        discount_type: 'percentage',
        value: 15,
        valid_from: '2026-08-21',
        valid_until: null,
        applicable_to: 'professional',
        branch_id: 3,
        course_id: 7,
        status: 'active',
      }),
    );
    expect(toastSpy.success).toHaveBeenCalled();
  });

  it('loadProfessionalCourses filtra por type=professional y por sede', async () => {
    const coursesBuilder = makeBuilder({
      data: [{ id: 7, name: 'Profesional A2' }],
      error: null,
    });
    fromMock.mockReturnValueOnce(coursesBuilder);

    await facade.loadProfessionalCourses(3);

    expect(coursesBuilder.eq).toHaveBeenCalledWith('type', 'professional');
    expect(coursesBuilder.eq).toHaveBeenCalledWith('active', true);
    expect(coursesBuilder.eq).toHaveBeenCalledWith('branch_id', 3);
    expect(facade.professionalCourses()).toEqual([{ id: 7, name: 'Profesional A2' }]);
  });

  it('toggleStatus alterna entre active/inactive sin borrar la fila', async () => {
    await facade.loadDiscounts();

    const updateBuilder = makeBuilder({ data: null, error: null });
    fromMock.mockReturnValueOnce(updateBuilder);
    const success = await facade.toggleStatus(1, 'active');

    expect(success).toBe(true);
    expect(updateBuilder.update).toHaveBeenCalledWith({ status: 'inactive' });
    expect(facade.discounts().find((d) => d.id === 1)?.status).toBe('inactive');
  });

  it('createDiscount reporta error via toast y no lanza si Supabase falla', async () => {
    fromMock.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'boom' } }));

    const success = await facade.createDiscount({
      name: 'X',
      discountType: 'fixed_amount',
      value: 1000,
      validFrom: '2026-01-01',
      validUntil: null,
      applicableTo: 'all',
      branchId: null,
      courseId: null,
    });

    expect(success).toBe(false);
    expect(toastSpy.error).toHaveBeenCalled();
  });
});
