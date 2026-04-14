import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EnrollmentDocumentsFacade } from './enrollment-documents.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type { DocumentType } from '@core/models/ui/enrollment-documents.model';

// ── Mock Supabase client ──

function createMockQueryBuilder(responseData: any = null, responseError: any = null) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: responseData, error: responseError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: responseData, error: responseError }),
  };
  return builder;
}

function createMockSupabaseService() {
  const mockBuilder = createMockQueryBuilder();

  return {
    client: {
      from: vi.fn().mockReturnValue(mockBuilder),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          remove: vi.fn().mockResolvedValue({ error: null }),
          createSignedUrl: vi
            .fn()
            .mockResolvedValue({
              data: { signedUrl: 'https://example.com/signed/photo.jpg' },
              error: null,
            }),
        }),
      },
    },
    _mockBuilder: mockBuilder,
  };
}

describe('EnrollmentDocumentsFacade', () => {
  let facade: EnrollmentDocumentsFacade;
  let mockSupabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseService();

    TestBed.configureTestingModule({
      providers: [EnrollmentDocumentsFacade, { provide: SupabaseService, useValue: mockSupabase }],
    });

    facade = TestBed.inject(EnrollmentDocumentsFacade);
  });

  // ── Initialization ──

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should initialize with no documents', () => {
    expect(facade.documents().size).toBe(0);
  });

  it('should initialize with no carnet photo', () => {
    expect(facade.carnetPhoto()).toBeNull();
  });

  it('should initialize with no loading state', () => {
    expect(facade.isUploading()).toBe(false);
  });

  it('should initialize with no error', () => {
    expect(facade.error()).toBeNull();
  });

  it('should initialize with no HVC validation', () => {
    expect(facade.hvcValidation()).toBeNull();
  });

  it('should initialize with camera state idle', () => {
    expect(facade.cameraState()).toBe('idle');
  });

  it('should initialize with photo tab as upload', () => {
    expect(facade.photoTab()).toBe('upload');
  });

  // ── Camera State ──

  describe('Camera State', () => {
    it('should set camera state to active', () => {
      facade.setCameraState('active');
      expect(facade.cameraState()).toBe('active');
    });

    it('should set camera state to captured', () => {
      facade.setCameraState('captured');
      expect(facade.cameraState()).toBe('captured');
    });
  });

  // ── Photo Tab ──

  describe('Photo Tab', () => {
    it('should switch to camera tab', () => {
      facade.setPhotoTab('camera');
      expect(facade.photoTab()).toBe('camera');
    });

    it('should switch back to upload tab', () => {
      facade.setPhotoTab('camera');
      facade.setPhotoTab('upload');
      expect(facade.photoTab()).toBe('upload');
    });
  });

  // ── Carnet Photo (local) ──

  describe('Carnet Photo', () => {
    it('should set carnet photo from capture', () => {
      facade.setCarnetPhoto({
        source: 'camera',
        dataUrl: 'data:image/png;base64,abc',
        fileName: 'capture.png',
      });
      expect(facade.carnetPhoto()).not.toBeNull();
      expect(facade.carnetPhoto()!.source).toBe('camera');
    });

    it('should clear carnet photo', () => {
      facade.setCarnetPhoto({
        source: 'upload',
        dataUrl: 'data:image/png;base64,abc',
        fileName: 'foto.png',
      });
      facade.clearCarnetPhoto();
      expect(facade.carnetPhoto()).toBeNull();
    });
  });

  // ── Document Requirements ──

  describe('Document Requirements', () => {
    it('should return class-b requirements for non-professional', () => {
      const reqs = facade.getRequirements('non-professional', false);
      // Class B: only photo (handled separately), no required professional docs
      expect(reqs.length).toBe(0);
    });

    it('should return professional requirements', () => {
      const reqs = facade.getRequirements('professional', false);
      expect(reqs.length).toBeGreaterThan(0);
      expect(reqs.some((r) => r.type === 'hoja_vida_conductor')).toBe(true);
    });

    it('should include notarial authorization for minors', () => {
      const reqs = facade.getRequirements('non-professional', true);
      expect(reqs.some((r) => r.type === 'autorizacion_notarial')).toBe(true);
    });
  });

  // ── HVC Validation ──

  describe('HVC Validation', () => {
    it('should detect expired HVC (more than 30 days)', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);
      facade.validateHvcDate(oldDate.toISOString().split('T')[0]);
      expect(facade.hvcValidation()?.expired).toBe(true);
    });

    it('should accept recent HVC (less than 30 days)', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);
      facade.validateHvcDate(recentDate.toISOString().split('T')[0]);
      expect(facade.hvcValidation()?.expired).toBe(false);
    });
  });

  // ── Upload Document ──

  describe('uploadDocument', () => {
    it('should return false without enrollment context', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const result = await facade.uploadDocument('cedula_identidad', file, null);
      expect(result).toBe(false);
    });
  });

  // ── Upload Carnet Photo ──

  describe('uploadCarnetPhoto', () => {
    it('should return false without enrollment context', async () => {
      const result = await facade.uploadCarnetPhoto('data:image/png;base64,abc', 'photo.png', null);
      expect(result).toBe(false);
    });
  });

  // ── Load Existing Documents ──

  describe('loadDocuments', () => {
    it('should call supabase to load documents for enrollment', async () => {
      const builder = createMockQueryBuilder();
      builder.order = vi.fn().mockResolvedValue({ data: [], error: null });
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      await facade.loadDocuments(42);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('student_documents');
    });

    it('should set error on failure', async () => {
      const builder = createMockQueryBuilder();
      builder.order = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'Connection failed' } });
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      await facade.loadDocuments(42);
      expect(facade.error()).toContain('Error al cargar documentos');
    });
  });

  // ── Docs Complete Check ──

  describe('allRequiredUploaded', () => {
    it('should return false when no documents uploaded', () => {
      expect(facade.allRequiredUploaded('professional', false)).toBe(false);
    });

    it('should return true for class-b with carnet photo', () => {
      facade.setCarnetPhoto({
        source: 'upload',
        dataUrl: 'data:image/png;base64,abc',
        fileName: 'foto.png',
      });
      expect(facade.allRequiredUploaded('non-professional', false)).toBe(true);
    });
  });

  // ── Reset ──

  describe('Reset', () => {
    it('should reset all state to initial values', () => {
      facade.setCarnetPhoto({
        source: 'camera',
        dataUrl: 'data:image/png;base64,abc',
        fileName: 'capture.png',
      });
      facade.setCameraState('captured');
      facade.setPhotoTab('camera');

      facade.reset();

      expect(facade.carnetPhoto()).toBeNull();
      expect(facade.cameraState()).toBe('idle');
      expect(facade.photoTab()).toBe('upload');
      expect(facade.documents().size).toBe(0);
      expect(facade.error()).toBeNull();
    });
  });

  // ── Error Handling ──

  describe('Error Handling', () => {
    it('should clear error', () => {
      facade.clearError();
      expect(facade.error()).toBeNull();
    });
  });
});
