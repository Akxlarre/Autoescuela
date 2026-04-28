import { describe, it, expect } from 'vitest';
import {
  computeOverallProgress,
  computeSemaphore,
  computeAverageGrade,
  computeCertificateBlockingReason,
  deriveCertificateState,
} from './student-home';
import type { StudentHomeSnapshot } from '@core/models/ui/student-home.model';

// ── computeOverallProgress ──────────────────────────────────────────────────

describe('computeOverallProgress', () => {
  it('calcula ponderación 60% prácticas + 40% teoría correctamente', () => {
    // 8/12 prácticas = 66.7% → 40; 92% teoría → 36.8 = 76.8 ≈ 77
    expect(computeOverallProgress(8, 12, 92)).toBe(77);
  });

  it('devuelve 0 cuando practicesTotal es 0', () => {
    expect(computeOverallProgress(0, 0, 100)).toBe(0);
  });

  it('devuelve 100 cuando todo está completo', () => {
    expect(computeOverallProgress(12, 12, 100)).toBe(100);
  });

  it('devuelve 0 cuando no hay avance', () => {
    expect(computeOverallProgress(0, 12, 0)).toBe(0);
  });
});

// ── computeSemaphore ────────────────────────────────────────────────────────

describe('computeSemaphore', () => {
  it('devuelve green con 0 ausencias', () => {
    expect(computeSemaphore(0)).toBe('green');
  });

  it('devuelve yellow con 1 ausencia consecutiva', () => {
    expect(computeSemaphore(1)).toBe('yellow');
  });

  it('devuelve red con 2 ausencias consecutivas', () => {
    expect(computeSemaphore(2)).toBe('red');
  });

  it('devuelve red con más de 2 ausencias', () => {
    expect(computeSemaphore(5)).toBe('red');
  });
});

// ── computeAverageGrade ─────────────────────────────────────────────────────

describe('computeAverageGrade', () => {
  it('devuelve null si no hay módulos con nota confirmada', () => {
    expect(computeAverageGrade([])).toBeNull();
  });

  it('devuelve null si todos los módulos son draft', () => {
    const modules = [{ number: 1, name: 'M1', grade: 80, passed: true, status: 'draft' as const }];
    expect(computeAverageGrade(modules)).toBeNull();
  });

  it('calcula promedio de módulos confirmados', () => {
    const modules = [
      { number: 1, name: 'M1', grade: 80, passed: true, status: 'confirmed' as const },
      { number: 2, name: 'M2', grade: 90, passed: true, status: 'confirmed' as const },
      { number: 3, name: 'M3', grade: null, passed: null, status: 'draft' as const },
    ];
    expect(computeAverageGrade(modules)).toBe(85);
  });

  it('redondea a 1 decimal', () => {
    const modules = [
      { number: 1, name: 'M1', grade: 75, passed: true, status: 'confirmed' as const },
      { number: 2, name: 'M2', grade: 80, passed: true, status: 'confirmed' as const },
      { number: 3, name: 'M3', grade: 77, passed: true, status: 'confirmed' as const },
    ];
    // (75+80+77)/3 = 77.333... → 77.3
    expect(computeAverageGrade(modules)).toBe(77.3);
  });
});

// ── computeCertificateBlockingReason ────────────────────────────────────────

function makeSnapshot(overrides: Partial<StudentHomeSnapshot> = {}): StudentHomeSnapshot {
  return {
    hero: {
      studentFirstName: 'Test',
      enrollmentNumber: 'E-001',
      licenseGroup: 'class_b',
      branchName: null,
      courseStartDate: null,
      enrollmentStatus: 'active',
    },
    progress: {
      practicesCompleted: 8,
      practicesTotal: 12,
      pctTheoryAttendance: 90,
      pctOverall: 77,
      practices: [],
    },
    attendance: {
      consecutiveAbsences: 0,
      semaphore: 'green',
      recentSessions: [],
    },
    grades: {
      finalExamGrade: null,
      finalExamDate: null,
      passed: null,
      modules: [],
      averageGrade: null,
    },
    certificate: {
      state: 'locked',
      folio: null,
      issuedDate: null,
      pdfUrl: null,
      blockingReason: null,
    },
    side: { nextClass: null, pendingBalance: 0, totalPaid: 0 },
    ...overrides,
  };
}

describe('computeCertificateBlockingReason', () => {
  it('devuelve null si el certificado ya está emitido', () => {
    const snapshot = makeSnapshot({
      certificate: {
        state: 'issued',
        folio: 'F-001',
        issuedDate: '2026-04-01',
        pdfUrl: null,
        blockingReason: null,
      },
    });
    expect(computeCertificateBlockingReason(snapshot)).toBeNull();
  });

  it('devuelve null si el certificado está habilitado', () => {
    const snapshot = makeSnapshot({
      certificate: {
        state: 'enabled',
        folio: null,
        issuedDate: null,
        pdfUrl: null,
        blockingReason: null,
      },
    });
    expect(computeCertificateBlockingReason(snapshot)).toBeNull();
  });

  it('devuelve mensaje plural para clases B faltantes (> 1)', () => {
    const snapshot = makeSnapshot();
    const reason = computeCertificateBlockingReason(snapshot);
    expect(reason).toBe('Te faltan 4 clases prácticas para habilitar tu certificado');
  });

  it('devuelve mensaje singular para 1 clase faltante', () => {
    const snapshot = makeSnapshot({
      progress: {
        practicesCompleted: 11,
        practicesTotal: 12,
        pctTheoryAttendance: 100,
        pctOverall: 99,
        practices: [],
      },
    });
    const reason = computeCertificateBlockingReason(snapshot);
    expect(reason).toBe('Te falta 1 clase práctica para habilitar tu certificado');
  });
});

// ── deriveCertificateState ───────────────────────────────────────────────────

describe('deriveCertificateState', () => {
  it('devuelve issued si hay certificado emitido', () => {
    expect(deriveCertificateState({ certificateEnabled: true, certificateIssued: true })).toBe(
      'issued',
    );
  });

  it('devuelve enabled si está habilitado pero no emitido', () => {
    expect(deriveCertificateState({ certificateEnabled: true, certificateIssued: false })).toBe(
      'enabled',
    );
  });

  it('devuelve locked si no está habilitado', () => {
    expect(deriveCertificateState({ certificateEnabled: false, certificateIssued: false })).toBe(
      'locked',
    );
  });
});
