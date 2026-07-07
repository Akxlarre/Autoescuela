import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StudentEnrollmentContextFacade } from './student-enrollment-context.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

// ── Mock Supabase: builder encadenable y awaitable ──

function createMockSupabase(rows: unknown[]) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: (resolve: any, reject: any) =>
      Promise.resolve({ data: rows, error: null }).then(resolve, reject),
  };
  return {
    client: { from: vi.fn().mockReturnValue(builder) },
    _builder: builder,
  };
}

function setup(rows: unknown[]) {
  const mockSupabase = createMockSupabase(rows);
  TestBed.configureTestingModule({
    providers: [{ provide: SupabaseService, useValue: mockSupabase }],
  });
  const facade = TestBed.inject(StudentEnrollmentContextFacade);
  return { facade, mockSupabase };
}

describe('StudentEnrollmentContextFacade', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('mapea class_b a "Clase B" y professional al nombre del curso', async () => {
    const { facade } = setup([
      { id: 1, number: null, license_group: 'class_b', courses: { name: 'Curso B' } },
      { id: 2, number: null, license_group: 'professional', courses: { name: 'A-4 Profesional' } },
    ]);
    await facade.initialize(77);
    expect(facade.enrollments()).toEqual([
      { id: 1, label: 'Clase B', licenseGroup: 'class_b' },
      { id: 2, label: 'A-4 Profesional', licenseGroup: 'professional' },
    ]);
  });

  it('agrega el sufijo "· #N" cuando la matrícula tiene número', async () => {
    const { facade } = setup([
      { id: 1, number: 'M-042', license_group: 'class_b', courses: { name: 'x' } },
    ]);
    await facade.initialize(77);
    expect(facade.enrollments()[0].label).toBe('Clase B · #M-042');
  });

  it('soporta courses como array (relación !inner puede devolver lista)', async () => {
    const { facade } = setup([
      { id: 3, number: null, license_group: 'professional', courses: [{ name: 'A-2' }] },
    ]);
    await facade.initialize(77);
    expect(facade.enrollments()[0].label).toBe('A-2');
  });

  it('activa la primera matrícula (la más reciente) al cargar', async () => {
    const { facade } = setup([
      { id: 9, number: null, license_group: 'class_b', courses: { name: 'x' } },
      { id: 4, number: null, license_group: 'class_b', courses: { name: 'x' } },
    ]);
    await facade.initialize(77);
    expect(facade.activeEnrollmentId()).toBe(9);
  });

  it('sin matrículas: tabs vacíos y sin activo', async () => {
    const { facade } = setup([]);
    await facade.initialize(77);
    expect(facade.enrollments()).toEqual([]);
    expect(facade.activeEnrollmentId()).toBeNull();
  });

  it('initialize es idempotente: la segunda llamada no re-consulta', async () => {
    const { facade, mockSupabase } = setup([]);
    await facade.initialize(77);
    await facade.initialize(77);
    expect(mockSupabase.client.from).toHaveBeenCalledTimes(1);
  });

  it('reset() limpia el estado y permite re-inicializar (logout → nuevo alumno)', async () => {
    const { facade, mockSupabase } = setup([
      { id: 1, number: null, license_group: 'class_b', courses: { name: 'x' } },
    ]);
    await facade.initialize(77);
    facade.reset();
    expect(facade.enrollments()).toEqual([]);
    expect(facade.activeEnrollmentId()).toBeNull();
    await facade.initialize(78);
    expect(mockSupabase.client.from).toHaveBeenCalledTimes(2);
  });

  it('setActive cambia la matrícula activa', async () => {
    const { facade } = setup([
      { id: 1, number: null, license_group: 'class_b', courses: { name: 'x' } },
      { id: 2, number: null, license_group: 'professional', courses: { name: 'y' } },
    ]);
    await facade.initialize(77);
    facade.setActive(2);
    expect(facade.activeEnrollmentId()).toBe(2);
  });
});
