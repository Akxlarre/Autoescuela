import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AnticiosFacade, tipoLabel, mapStatus } from './anticipos.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';

// ─── Helpers puros ────────────────────────────────────────────────────────────

describe('tipoLabel()', () => {
  it('mapea theory → Teórico', () => {
    expect(tipoLabel('theory')).toBe('Teórico');
  });
  it('mapea practice → Práctico', () => {
    expect(tipoLabel('practice')).toBe('Práctico');
  });
  it('mapea both → Teórico y Práctico', () => {
    expect(tipoLabel('both')).toBe('Teórico y Práctico');
  });
  it('retorna — para null', () => {
    expect(tipoLabel(null)).toBe('—');
  });
  it('retorna el valor original si no hay mapeo', () => {
    expect(tipoLabel('unknown')).toBe('unknown');
  });
});

describe('mapStatus()', () => {
  it('mapea discounted → discounted', () => {
    expect(mapStatus('discounted')).toBe('discounted');
  });
  it('mapea deducted → discounted (alias)', () => {
    expect(mapStatus('deducted')).toBe('discounted');
  });
  it('mapea pending → pending', () => {
    expect(mapStatus('pending')).toBe('pending');
  });
  it('mapea null → pending', () => {
    expect(mapStatus(null)).toBe('pending');
  });
});

// ─── KPIs computed ────────────────────────────────────────────────────────────

describe('AnticiosFacade — kpis computed', () => {
  let facade: AnticiosFacade;

  const mockSupabase = {
    client: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    },
  };
  const mockAuth = { currentUser: vi.fn().mockReturnValue({ dbId: 1 }) };
  const mockToast = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AnticiosFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: AuthFacade, useValue: mockAuth },
        { provide: ToastService, useValue: mockToast },
      ],
    });
    facade = TestBed.inject(AnticiosFacade);
  });

  it('inicia con KPIs en cero', () => {
    const kpis = facade.kpis();
    expect(kpis.totalPendiente).toBe(0);
    expect(kpis.totalHistorico).toBe(0);
    expect(kpis.totalDescontado).toBe(0);
    expect(kpis.instructoresConSaldo).toBe(0);
  });

  it('isLoading inicia en false', () => {
    expect(facade.isLoading()).toBe(false);
  });

  it('isSaving inicia en false', () => {
    expect(facade.isSaving()).toBe(false);
  });

  it('historial inicia vacío', () => {
    expect(facade.historial()).toHaveLength(0);
  });

  it('cuentaCorriente inicia vacía', () => {
    expect(facade.cuentaCorriente()).toHaveLength(0);
  });

  it('instructores inicia vacío', () => {
    expect(facade.instructores()).toHaveLength(0);
  });
});

// ─── registrarAnticipo — sin sesión ──────────────────────────────────────────

describe('AnticiosFacade.registrarAnticipo()', () => {
  let facade: AnticiosFacade;
  const mockToast = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AnticiosFacade,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              from: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
            },
          },
        },
        { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue(null) } },
        { provide: ToastService, useValue: mockToast },
      ],
    });
    facade = TestBed.inject(AnticiosFacade);
  });

  it('retorna false y muestra error cuando no hay sesión', async () => {
    const result = await facade.registrarAnticipo({
      instructorId: 1,
      date: '2026-04-01',
      amount: 50000,
      reason: 'salary',
      description: '',
    });
    expect(result).toBe(false);
    expect(mockToast.error).toHaveBeenCalledWith('No hay sesión activa.');
  });
});
