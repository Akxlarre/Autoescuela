import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Meses permitidos para el límite de visualización de la Agenda. */
export type AgendaVisibilityMonths = 2 | 3 | 4;

const VALID_MONTHS: readonly AgendaVisibilityMonths[] = [2, 3, 4];
const DEFAULT_MONTHS: AgendaVisibilityMonths = 3;

/**
 * AgendaSettingsService — Preferencia global (persistida en localStorage) que
 * limita cuántos meses hacia el futuro se puede navegar/agendar en la Agenda.
 *
 * Mismo patrón que ThemeService: signal + localStorage, sin tocar Supabase
 * (preferencia de UI local al dispositivo, no dato de dominio — por eso vive
 * en core/services/ui/, no en un Facade).
 */
@Injectable({ providedIn: 'root' })
export class AgendaSettingsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly STORAGE_KEY = 'app-agenda-visibility-months';

  private readonly _visibilityMonths = signal<AgendaVisibilityMonths>(this.loadInitial());

  /** Meses hacia el futuro que el usuario puede navegar/agendar (2, 3 o 4). */
  readonly visibilityMonths = this._visibilityMonths.asReadonly();

  /** Fecha límite (ISO YYYY-MM-DD) — hoy + `visibilityMonths` meses. */
  readonly maxVisibleDateIso = computed(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + this._visibilityMonths());
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  /** Etiqueta legible: "18 de septiembre, 2026". */
  readonly maxVisibleDateLabel = computed(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + this._visibilityMonths());
    const dayMonth = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
    return `${dayMonth}, ${d.getFullYear()}`;
  });

  setVisibilityMonths(months: AgendaVisibilityMonths): void {
    if (!VALID_MONTHS.includes(months)) return;
    this._visibilityMonths.set(months);
    this.saveToStorage(months);
  }

  private loadInitial(): AgendaVisibilityMonths {
    if (!isPlatformBrowser(this.platformId)) return DEFAULT_MONTHS;
    const raw = localStorage.getItem(this.STORAGE_KEY);
    const parsed = raw ? Number(raw) : DEFAULT_MONTHS;
    return VALID_MONTHS.includes(parsed as AgendaVisibilityMonths)
      ? (parsed as AgendaVisibilityMonths)
      : DEFAULT_MONTHS;
  }

  private saveToStorage(months: AgendaVisibilityMonths): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(this.STORAGE_KEY, String(months));
  }
}
