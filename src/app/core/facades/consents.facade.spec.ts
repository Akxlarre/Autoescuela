import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConsentsFacade } from './consents.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { ToastService } from '@core/services/ui/toast.service';
import type { ConsentDraft } from '@core/models/ui/consent.model';
import { PRIVACY_POLICY_VERSION } from '@core/models/ui/privacy-policy.model';

/**
 * Spec 0009-m — ConsentsFacade.
 * Registro append-only de consentimientos (Ley 21.719).
 */
describe('ConsentsFacade', () => {
  let facade: ConsentsFacade;
  let supabaseSpy: any;
  let toastSpy: any;
  let insertSpy: any;
  let updateSpy: any;

  const draft: ConsentDraft = {
    consentType: 'matricula_datos',
    granted: true,
    branchId: 2,
    source: 'secretaria',
    userId: 10,
    subjectRut: '18.456.789-0',
    enrollmentId: 55,
  };

  /** `.from('consents').insert([...])` que resuelve `{ error }`. */
  function buildInsert(error: any = null) {
    insertSpy = vi.fn().mockResolvedValue({ error });
    return vi.fn().mockReturnValue({ insert: insertSpy });
  }

  /** `.from('consents').update({...}).eq('id', n)` que resuelve `{ error }`. */
  function buildUpdate(error: any = null) {
    const eq = vi.fn().mockResolvedValue({ error });
    updateSpy = vi.fn().mockReturnValue({ eq });
    return vi.fn().mockReturnValue({ update: updateSpy });
  }

  /** `.from('consents').select(...).eq(...).order(...)` que resuelve `{ data, error }`. */
  function buildSelect(data: any[], error: any = null) {
    const order = vi.fn().mockResolvedValue({ data, error });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    return vi.fn().mockReturnValue({ select });
  }

  function setup(fromImpl: any) {
    supabaseSpy = { client: { from: fromImpl } };
    toastSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        ConsentsFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: any) => ({ message: String(e?.message ?? e) }) },
        },
        { provide: ToastService, useValue: toastSpy },
      ],
    });

    facade = TestBed.inject(ConsentsFacade);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('recordMany()', () => {
    it('persiste un registro por cada draft, en snake_case (AC5)', async () => {
      setup(buildInsert());

      const ok = await facade.recordMany([draft]);

      expect(ok).toBe(true);
      const rows = insertSpy.mock.calls[0][0];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        consent_type: 'matricula_datos',
        granted: true,
        branch_id: 2,
        source: 'secretaria',
        user_id: 10,
        subject_rut: '18.456.789-0',
        enrollment_id: 55,
      });
    });

    it('estampa la versión de política vigente (AC-E4)', async () => {
      setup(buildInsert());

      await facade.recordMany([draft]);

      expect(insertSpy.mock.calls[0][0][0].policy_version).toBe(PRIVACY_POLICY_VERSION);
    });

    // La IP es la prueba de que el consentimiento se otorgó desde donde dice. Si la
    // pudiera poner el cliente, no probaría nada: la escribe el trigger de la BD.
    it('NUNCA envía la ip: la pone el servidor', async () => {
      setup(buildInsert());

      await facade.recordMany([draft]);

      expect(insertSpy.mock.calls[0][0][0]).not.toHaveProperty('ip');
    });

    it('registra la negativa igual que la aceptación (AC-E1)', async () => {
      setup(buildInsert());

      await facade.recordMany([{ ...draft, granted: false }]);

      expect(insertSpy.mock.calls[0][0][0].granted).toBe(false);
    });

    it('inserta los N drafts en una sola llamada', async () => {
      setup(buildInsert());

      await facade.recordMany([draft, { ...draft, consentType: 'certificado_medico' }]);

      expect(insertSpy).toHaveBeenCalledTimes(1);
      expect(insertSpy.mock.calls[0][0]).toHaveLength(2);
    });

    it('lista vacía: no toca la base', async () => {
      setup(buildInsert());

      const ok = await facade.recordMany([]);

      expect(ok).toBe(true);
      expect(insertSpy).not.toHaveBeenCalled();
    });

    it('ante error expone el signal de error y avisa por toast', async () => {
      setup(buildInsert({ message: 'permission denied' }));

      const ok = await facade.recordMany([draft]);

      expect(ok).toBe(false);
      expect(facade.error()).toContain('permission denied');
      expect(toastSpy.error).toHaveBeenCalled();
    });

    it('ante excepción inesperada devuelve false sin propagar', async () => {
      setup(
        vi.fn().mockReturnValue({
          insert: vi.fn().mockRejectedValue(new Error('boom')),
        }),
      );

      await expect(facade.recordMany([draft])).resolves.toBe(false);
      expect(facade.error()).not.toBeNull();
    });
  });

  describe('loadByUser()', () => {
    it('mapea las filas a ConsentRow con etiquetas legibles (AC6)', async () => {
      setup(
        buildSelect([
          {
            id: 1,
            consent_type: 'certificado_medico',
            granted: true,
            granted_at: '2026-08-17T10:00:00Z',
            revoked_at: null,
            policy_version: '2026-08-17',
            source: 'secretaria',
            ip: '190.44.7.12',
            granted_by_representative: false,
          },
        ]),
      );

      await facade.loadByUser(10);

      const [row] = facade.consents();
      expect(row.typeLabel).toBe('Certificado médico (dato de salud)');
      expect(row.sourceLabel).toBe('En secretaría');
      expect(row.status).toBe('otorgado');
    });

    it('deriva el estado: rechazado cuando granted es false', async () => {
      setup(
        buildSelect([
          {
            id: 2,
            consent_type: 'certificado_medico',
            granted: false,
            granted_at: '2026-08-17T10:00:00Z',
            revoked_at: null,
            policy_version: '2026-08-17',
            source: 'secretaria',
            ip: null,
            granted_by_representative: false,
          },
        ]),
      );

      await facade.loadByUser(10);

      expect(facade.consents()[0].status).toBe('rechazado');
    });

    it('deriva el estado: revocado cuando hay revoked_at (AC-E3)', async () => {
      setup(
        buildSelect([
          {
            id: 3,
            consent_type: 'matricula_datos',
            granted: true,
            granted_at: '2026-08-17T10:00:00Z',
            revoked_at: '2026-09-01T10:00:00Z',
            policy_version: '2026-08-17',
            source: 'public',
            ip: null,
            granted_by_representative: false,
          },
        ]),
      );

      await facade.loadByUser(10);

      expect(facade.consents()[0].status).toBe('revocado');
    });
  });

  describe('recordMedicalCertificate() — Art. 16 (AC4/AC-E1)', () => {
    /** `.from('enrollments').select().eq().maybeSingle()` + `.from('consents').insert()`. */
    function setupMedical(enrollmentRow: any, insertError: any = null) {
      insertSpy = vi.fn().mockResolvedValue({ error: insertError });
      const maybeSingle = vi.fn().mockResolvedValue({ data: enrollmentRow, error: null });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      setup(
        vi.fn().mockImplementation((table: string) =>
          table === 'enrollments' ? { select } : { insert: insertSpy },
        ),
      );
    }

    it('resuelve titular y sede desde la matrícula', async () => {
      setupMedical({ branch_id: 2, students: { user_id: 77 } });

      const ok = await facade.recordMedicalCertificate(55, true);

      expect(ok).toBe(true);
      expect(insertSpy.mock.calls[0][0][0]).toMatchObject({
        consent_type: 'certificado_medico',
        granted: true,
        branch_id: 2,
        user_id: 77,
        enrollment_id: 55,
        source: 'secretaria',
      });
    });

    it('soporta la relación como arreglo (forma que devuelve PostgREST según el join)', async () => {
      setupMedical({ branch_id: 1, students: [{ user_id: 88 }] });

      await facade.recordMedicalCertificate(56, true);

      expect(insertSpy.mock.calls[0][0][0].user_id).toBe(88);
    });

    // AC-E1: "no autorizó" y "nadie le preguntó" son hechos distintos ante la Agencia.
    it('registra la negativa con granted=false', async () => {
      setupMedical({ branch_id: 2, students: { user_id: 77 } });

      await facade.recordMedicalCertificate(55, false);

      expect(insertSpy.mock.calls[0][0][0].granted).toBe(false);
    });

    it('sin titular identificable no registra nada y devuelve false', async () => {
      setupMedical({ branch_id: 2, students: null });

      const ok = await facade.recordMedicalCertificate(55, true);

      expect(ok).toBe(false);
      expect(insertSpy).not.toHaveBeenCalled();
    });
  });

  describe('revoke()', () => {
    // AC6/AC-E3: el registro original NO se borra ni se edita. La base tiene un
    // trigger que lo impide; el Facade no debe siquiera intentarlo.
    it('solo actualiza revoked_at', async () => {
      setup(buildUpdate());

      const ok = await facade.revoke(7);

      expect(ok).toBe(true);
      const payload = updateSpy.mock.calls[0][0];
      expect(Object.keys(payload)).toEqual(['revoked_at']);
    });

    it('ante error devuelve false y expone el mensaje', async () => {
      setup(buildUpdate({ message: 'append-only' }));

      const ok = await facade.revoke(7);

      expect(ok).toBe(false);
      expect(facade.error()).toContain('append-only');
    });
  });
});
