import { NgTemplateOutlet } from '@angular/common';
import { Component, ContentChild, NO_ERRORS_SCHEMA, TemplateRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AdminExAlumnosTasasDrawerComponent } from './admin-ex-alumnos-tasas-drawer.component';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';

@Component({
  selector: 'app-drawer-content-loader',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: '<ng-container [ngTemplateOutlet]="contentTpl ?? null" />',
})
class StubDrawerContentLoaderComponent {
  @ContentChild('content') contentTpl?: TemplateRef<unknown>;
}

describe('AdminExAlumnosTasasDrawerComponent', () => {
  let facadeSpy: any;

  function setup(overrides: Record<string, unknown> = {}) {
    facadeSpy = {
      municipalApprovalRate: vi.fn().mockReturnValue(80),
      psychoApprovalRate: vi.fn().mockReturnValue(80),
      totalExamenes: vi.fn().mockReturnValue(10),
      annualEgresadosTotal: vi.fn().mockReturnValue(25),
      annualLicensesTotal: vi.fn().mockReturnValue(20),
      successConversionRate: vi.fn().mockReturnValue(80),
      statsError: vi.fn().mockReturnValue(null),
      statsRefreshFailed: vi.fn().mockReturnValue(false),
      isLoading: vi.fn().mockReturnValue(false),
      reintentarStats: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };

    TestBed.configureTestingModule({
      imports: [AdminExAlumnosTasasDrawerComponent],
      providers: [{ provide: ExAlumnosFacade, useValue: facadeSpy }],
    });
    TestBed.overrideComponent(AdminExAlumnosTasasDrawerComponent, {
      set: { imports: [StubDrawerContentLoaderComponent], schemas: [NO_ERRORS_SCHEMA] },
    });

    const fixture = TestBed.createComponent(AdminExAlumnosTasasDrawerComponent);
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture;
  }

  it('muestra las tasas cuando statsError() es null', () => {
    const fixture = setup();
    const statsEl = fixture.nativeElement.querySelector('app-admin-stats-panel') as any;
    const emptyEl = fixture.nativeElement.querySelector('app-empty-state');
    expect(statsEl).toBeTruthy();
    expect(statsEl.municipalRate).toBe(80);
    expect(emptyEl).toBeNull();
  });

  it('cuando statsError() tiene error (Caso A), muestra app-empty-state con Reintentar y NO renderiza stats', () => {
    const fixture = setup({
      statsError: vi.fn().mockReturnValue('No se pudieron cargar las tasas de aprobación.'),
      municipalApprovalRate: vi.fn().mockReturnValue(0),
      totalExamenes: vi.fn().mockReturnValue(0),
    });

    const statsEl = fixture.nativeElement.querySelector('app-admin-stats-panel');
    const emptyEl = fixture.nativeElement.querySelector('app-empty-state') as any;
    expect(statsEl).toBeNull();
    expect(emptyEl).toBeTruthy();
    expect(emptyEl.message).toBe('No se pudieron cargar las tasas de aprobación.');
    expect(emptyEl.getAttribute('actionLabel')).toBe('Reintentar');

    emptyEl.dispatchEvent(new CustomEvent('action'));
    expect(facadeSpy.reintentarStats).toHaveBeenCalledTimes(1);
  });

  it('en Caso B (statsRefreshFailed() = true), conserva stats visibles y muestra app-alert-card con Reintentar', () => {
    const fixture = setup({
      statsRefreshFailed: vi.fn().mockReturnValue(true),
    });

    const alertEl = fixture.nativeElement.querySelector('app-alert-card') as any;
    const statsEl = fixture.nativeElement.querySelector('app-admin-stats-panel') as any;
    expect(alertEl).toBeTruthy();
    expect(alertEl.title).toBe('No se pudieron actualizar las tasas');
    expect(statsEl).toBeTruthy();
    expect(statsEl.municipalRate).toBe(80);

    const retryBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      '[data-llm-action="reintentar-tasas"]',
    );
    expect(retryBtn).toBeTruthy();
    retryBtn?.click();
    expect(facadeSpy.reintentarStats).toHaveBeenCalledTimes(1);
  });
});
