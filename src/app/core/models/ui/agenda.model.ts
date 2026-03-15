// Agenda Semanal — UI Models

// ─── KPIs semanales ────────────────────────────────────────────────────────

export interface AgendaWeekKpis {
  clasesAgendadas: number;
  clasesCompletadas: number;
  instructoresDisponibles: number;
  vehiculosDisponibles: number;
}

// ─── Slot individual del calendario ────────────────────────────────────────

/** Mapa directo de los status de class_b_sessions + 'available' para slots libres. */
export type AgendaSlotStatus =
  | 'available'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface AgendaSlot {
  /** slot_start TIMESTAMPTZ (ISO string) — usado como scheduled_at al agendar */
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  status: AgendaSlotStatus;
  instructorId: number;
  instructorName: string;
  vehicleId: number;
  vehiclePlate: string;
  // Solo presente cuando status !== 'available'
  sessionId?: number;
  enrollmentId?: number;
  studentName?: string;
  classNumber?: number;
}

// ─── Columna de un día ─────────────────────────────────────────────────────

export interface AgendaDayColumn {
  date: string; // YYYY-MM-DD
  label: string; // "Lun 17 mar"
  isToday: boolean;
  slots: AgendaSlot[];
}

// ─── Datos completos de la semana (para el componente Dumb) ───────────────

export interface AgendaWeekData {
  weekStart: string; // YYYY-MM-DD (lunes)
  weekEnd: string; // YYYY-MM-DD (viernes o domingo)
  weekLabel: string; // "17 – 21 mar"
  days: AgendaDayColumn[];
  timeRows: string[]; // ['09:00', '09:45', '10:30', ...]
  kpis: AgendaWeekKpis;
}

// ─── Alumno agendable (tiene clases restantes sin asignar) ─────────────────

export interface AgendableStudent {
  enrollmentId: number;
  studentName: string;
  courseName: string;
  totalSessions: number;
  scheduledSessions: number;
  remainingSessions: number;
}

// ─── Filtro de instructor ──────────────────────────────────────────────────

export interface AgendaInstructorFilter {
  id: number;
  name: string;
}
