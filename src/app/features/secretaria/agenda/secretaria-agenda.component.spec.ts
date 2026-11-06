import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SecretariaAgendaComponent } from './secretaria-agenda.component';
import { AgendaFacade } from '@core/facades/agenda.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AgendaSettingsService } from '@core/services/ui/agenda-settings.service';

describe('SecretariaAgendaComponent (hotfix-171-b)', () => {
  const selectedBranchId = signal<number | null>(1);
  const facade = {
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    setSelectedSlot: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    selectedBranchId.set(1);
    TestBed.configureTestingModule({
      providers: [
        { provide: AgendaFacade, useValue: facade },
        { provide: BranchFacade, useValue: { selectedBranchId } },
        { provide: LayoutDrawerFacadeService, useValue: { push: vi.fn() } },
        { provide: AgendaSettingsService, useValue: {} },
      ],
    });
    // Solo la clase: el template (agenda-semanal) no es lo que se prueba.
    TestBed.overrideComponent(SecretariaAgendaComponent, { set: { template: '', imports: [] } });
  });

  function crear() {
    const fixture = TestBed.createComponent(SecretariaAgendaComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('carga la Agenda una vez al entrar', () => {
    crear();
    expect(facade.initialize).toHaveBeenCalledTimes(1);
  });

  it('vuelve a cargar cuando la secretaria con las dos sedes cambia de sede (S16)', () => {
    const fixture = crear();
    selectedBranchId.set(2);
    fixture.detectChanges();
    expect(facade.initialize).toHaveBeenCalledTimes(2);
  });

  it('cierra el canal al salir', () => {
    crear().destroy();
    expect(facade.dispose).toHaveBeenCalledTimes(1);
  });
});
