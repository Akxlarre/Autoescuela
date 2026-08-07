import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { AdminSecretariasComponent } from './admin-secretarias.component';
import { SecretariasFacade } from '@core/facades/secretarias.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { LayoutService } from '@core/services/ui/layout.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SecretariaTableRow } from '@core/models/ui/secretaria-table.model';

// ─── fix-017-i (ASG-b-068): densidad adaptativa app-like ───
describe('AdminSecretariasComponent — densidad app-like', () => {
  let component: AdminSecretariasComponent;
  let tierSig: ReturnType<typeof signal<'mobile' | 'tablet' | 'desktop'>>;

  const buildSecretaria = (id: number): SecretariaTableRow =>
    ({
      id,
      nombre: `Secretaria ${id}`,
      email: `sec${id}@test.com`,
      sede: 'Sede A',
      estado: 'activa',
      initials: 'SA',
    }) as SecretariaTableRow;

  const secretarias = Array.from({ length: 25 }, (_, i) => buildSecretaria(i + 1));

  function setup(schemas: unknown[] = []): void {
    tierSig = signal<'mobile' | 'tablet' | 'desktop'>('desktop');

    TestBed.configureTestingModule({
      imports: [AdminSecretariasComponent],
      schemas: schemas as never,
      providers: [
        {
          provide: SecretariasFacade,
          useValue: {
            isLoading: signal(false),
            secretarias: signal(secretarias),
            totalSecretarias: signal(secretarias.length),
            sedesConPersonal: signal(1),
            activas: signal(secretarias.length),
            inactivas: signal(0),
            initialize: vi.fn(),
            selectSecretaria: vi.fn(),
          },
        },
        { provide: BranchFacade, useValue: { selectedBranchId: signal(null) } },
        { provide: LayoutDrawerFacadeService, useValue: { open: vi.fn(), close: vi.fn() } },
        { provide: LayoutService, useValue: { tier: tierSig } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
      ],
    });

    component = TestBed.createComponent(AdminSecretariasComponent).componentInstance;
  }

  beforeEach(() => setup());

  describe('desktop (tier=desktop)', () => {
    it('maxVisible es null → sin límite', () => {
      expect((component as any).maxVisible()).toBeNull();
    });

    it('visibleSecretarias muestra todas las filas filtradas', () => {
      expect((component as any).visibleSecretarias().length).toBe(secretarias.length);
    });

    it('remainingSecretarias es 0 (no hay "Cargar más" en desktop)', () => {
      expect((component as any).remainingSecretarias()).toBe(0);
    });
  });

  describe('mobile/tablet (tier=mobile)', () => {
    beforeEach(() => tierSig.set('mobile'));

    it('maxVisible arranca en el step (10)', () => {
      expect((component as any).maxVisible()).toBe(10);
    });

    it('visibleSecretarias recorta al presupuesto inicial', () => {
      expect((component as any).visibleSecretarias().length).toBe(10);
    });

    it('remainingSecretarias refleja lo que falta por mostrar', () => {
      expect((component as any).remainingSecretarias()).toBe(15);
    });

    it('loadMoreSecretarias incrementa el presupuesto en un step', () => {
      (component as any).loadMoreSecretarias();
      expect((component as any).visibleSecretarias().length).toBe(20);
      expect((component as any).remainingSecretarias()).toBe(5);
    });

    it('loadMoreSecretarias repetido nunca excede el total disponible', () => {
      (component as any).loadMoreSecretarias();
      (component as any).loadMoreSecretarias();
      expect((component as any).visibleSecretarias().length).toBe(25);
      expect((component as any).remainingSecretarias()).toBe(0);
    });
  });

  describe('reset de densidad al cambiar filtros', () => {
    beforeEach(() => tierSig.set('mobile'));

    it('updateSearchTerm tras "Cargar más" reinicia el presupuesto al step', () => {
      (component as any).loadMoreSecretarias();
      expect((component as any).mobileShown()).toBe(20);

      (component as any).updateSearchTerm('secretaria 1');

      expect((component as any).mobileShown()).toBe(10);
    });

    it('updateFiltroSede (usado por filtroSedeModel) también resetea la densidad', () => {
      (component as any).loadMoreSecretarias();
      (component as any).filtroSedeModel = 'Sede A';

      expect((component as any).mobileShown()).toBe(10);
    });

    it('updateFiltroEstado (usado por filtroEstadoModel) también resetea la densidad', () => {
      (component as any).loadMoreSecretarias();
      (component as any).filtroEstadoModel = 'activa';

      expect((component as any).mobileShown()).toBe(10);
    });
  });
});
