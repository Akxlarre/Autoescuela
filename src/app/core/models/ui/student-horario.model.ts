// ─── Sesión individual del horario del alumno ────────────────────────────────

export interface StudentHorarioSessionItem {
  id: string;
  kind: 'practice' | 'theory' | 'prof_theory' | 'prof_practice';
  /** Número de clase práctica (solo Clase B). */
  classNumber?: number;
  date: string; // YYYY-MM-DD
  /** HH:MM — vacío para sesiones profesionales (solo tienen fecha). */
  startTime: string;
  status: string;
  isPast: boolean;
  /** Marca la primera sesión futura (próxima clase). Solo una por snapshot. */
  isNext: boolean;
}

// ─── Día de la semana ────────────────────────────────────────────────────────

export interface StudentHorarioDay {
  date: string; // YYYY-MM-DD
  label: string; // "Lun 12 May"
  isToday: boolean;
  isPast: boolean;
  sessions: StudentHorarioSessionItem[];
}

// ─── Metadatos de la semana mostrada ─────────────────────────────────────────

export interface StudentHorarioWeekMeta {
  weekStart: string; // YYYY-MM-DD (siempre lunes)
  weekEnd: string; // YYYY-MM-DD (siempre domingo)
  weekLabel: string; // "12–18 may"
}
