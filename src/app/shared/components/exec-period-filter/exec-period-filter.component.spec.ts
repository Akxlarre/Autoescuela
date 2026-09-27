import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ExecPeriodFilterComponent } from './exec-period-filter.component';
import type {
  ExecDateRange,
  ExecPeriodPreset,
  ExecRangeChange,
} from '@core/models/ui/executive-dashboard.model';

/** Acceso a la API protegida del componente (lógica del filtro, sin DOM del popover). */
type FilterApi = {
  selected: () => ExecPeriodPreset;
  draft: () => (Date | null)[] | null;
  onPresetChange: (p: ExecPeriodPreset) => void;
  onDraftChange: (d: (Date | null)[] | null) => void;
  apply: () => void;
  onPickerHide: () => void;
  openPicker: () => void;
  hidePicker: () => void;
};

/**
 * Los signal inputs no son escribibles en esta infra de tests (JIT sin el transform de
 * initializer APIs; ver asistencia-clase-b-content.component.spec.ts). Se stubean con
 * signal() locales y se prueba la lógica sin renderizar el template (el popover es DOM).
 */
function setup(preset: ExecPeriodPreset = 'this_month') {
  TestBed.configureTestingModule({ imports: [ExecPeriodFilterComponent] });
  const component = TestBed.createComponent(ExecPeriodFilterComponent).componentInstance;
  const stub = <T>(name: string, value: T) =>
    Object.defineProperty(component, name, { value: signal<T>(value) });
  stub<ExecPeriodPreset>('preset', preset);
  stub<ExecDateRange>('range', { from: '2026-09-01', to: '2026-09-27' });
  stub('today', '2026-09-27');

  const api = component as unknown as FilterApi;
  const emitted: ExecRangeChange[] = [];
  component.rangeChange.subscribe((e) => emitted.push(e));
  const open = vi.spyOn(api, 'openPicker').mockImplementation(() => undefined);
  const hide = vi.spyOn(api, 'hidePicker').mockImplementation(() => undefined);
  return { api, emitted, open, hide };
}

describe('ExecPeriodFilterComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('un preset emite su rango resuelto contra hoy', () => {
    const { api, emitted } = setup();
    api.onPresetChange('last_month');
    expect(emitted).toEqual([
      { range: { from: '2026-08-01', to: '2026-08-31' }, preset: 'last_month' },
    ]);
  });

  it('fix-176-b: elegir "Personalizado" abre el calendario y NO recarga todavía', () => {
    const { api, emitted, open } = setup();
    api.onPresetChange('custom');
    expect(open).toHaveBeenCalledOnce();
    expect(emitted).toEqual([]);
    // El borrador arranca en el rango vigente.
    expect(api.draft()?.map((d) => d?.getDate())).toEqual([1, 27]);
  });

  it('fix-176-b: cambiar fechas en el calendario no emite; "Aplicar" emite una sola vez', () => {
    const { api, emitted, hide } = setup();
    api.onPresetChange('custom');
    api.onDraftChange([new Date(2026, 8, 3), null]);
    api.onDraftChange([new Date(2026, 8, 3), new Date(2026, 8, 20)]);
    expect(emitted).toEqual([]);

    api.apply();
    expect(emitted).toEqual([
      { range: { from: '2026-09-03', to: '2026-09-20' }, preset: 'custom' },
    ]);
    expect(hide).toHaveBeenCalledOnce();
  });

  it('fix-176-b: cerrar el calendario sin aplicar vuelve el selector al preset vigente', () => {
    const { api, emitted } = setup('this_month');
    api.onPresetChange('custom');
    expect(api.selected()).toBe('custom');

    api.onPickerHide();
    expect(api.selected()).toBe('this_month');
    expect(emitted).toEqual([]);
  });

  it('fix-176-b: tras aplicar, cerrar el calendario no revierte el selector', () => {
    const { api } = setup('this_month');
    api.onPresetChange('custom');
    api.onDraftChange([new Date(2026, 8, 3), new Date(2026, 8, 20)]);
    api.apply();
    api.onPickerHide();
    expect(api.selected()).toBe('custom');
  });

  it('"Aplicar" sin fecha de inicio no emite', () => {
    const { api, emitted } = setup();
    api.onPresetChange('custom');
    api.onDraftChange(null);
    api.apply();
    expect(emitted).toEqual([]);
  });
});
