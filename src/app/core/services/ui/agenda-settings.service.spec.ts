import { TestBed } from '@angular/core/testing';
import { AgendaSettingsService } from './agenda-settings.service';

describe('AgendaSettingsService', () => {
  let service: AgendaSettingsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AgendaSettingsService);
  });

  it('usa 3 meses por defecto cuando no hay valor guardado', () => {
    expect(service.visibilityMonths()).toBe(3);
  });

  it('setVisibilityMonths actualiza el signal y persiste en localStorage', () => {
    service.setVisibilityMonths(4);
    expect(service.visibilityMonths()).toBe(4);
    expect(localStorage.getItem('app-agenda-visibility-months')).toBe('4');
  });

  it('ignora valores fuera del set permitido (2, 3, 4)', () => {
    service.setVisibilityMonths(4);
    service.setVisibilityMonths(7 as any);
    expect(service.visibilityMonths()).toBe(4);
  });

  it('recupera el valor persistido de una sesión anterior al construirse', () => {
    localStorage.setItem('app-agenda-visibility-months', '2');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fresh = TestBed.inject(AgendaSettingsService);
    expect(fresh.visibilityMonths()).toBe(2);
  });

  it('maxVisibleDateIso calcula hoy + N meses en formato YYYY-MM-DD', () => {
    service.setVisibilityMonths(2);
    const expected = new Date();
    expected.setMonth(expected.getMonth() + 2);
    const expectedIso = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;
    expect(service.maxVisibleDateIso()).toBe(expectedIso);
  });

  it('maxVisibleDateLabel produce el formato "día de mes, año"', () => {
    service.setVisibilityMonths(3);
    const label = service.maxVisibleDateLabel();
    expect(label).toMatch(/^\d{1,2} de [a-záéíóúñ]+, \d{4}$/);
  });
});
