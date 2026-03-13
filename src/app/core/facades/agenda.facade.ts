import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from './auth.facade';
import type {
  AgendaWeekData,
  AgendaWeekKpis,
  AgendaSlot,
  AgendaSlotStatus,
  AgendaDayColumn,
  AgendableStudent,
  AgendaInstructorFilter,
} from '@core/models/ui/agenda.model';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMondayOfCurrentWeek(): string {
  const today = new Date();
  const day = today.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toLocaleDateString('en-CA'); // YYYY-MM-DD local
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA');
}

function tsToTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function tsToDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}

function buildDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dayName = d.toLocaleDateString('es', { weekday: 'short' });
  const dayNum = d.toLocaleDateString('es', { day: 'numeric' });
  const month = d.toLocaleDateString('es', { month: 'short' });
  return `${capitalize(dayName)} ${dayNum} ${month}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toLocaleDateString('en-CA');
}

// ─── Tipos internos crudos (respuesta de Supabase) ──────────────────────────

interface RawSlot {
  instructor_id: number;
  vehicle_id: number;
  slot_start: string;
  slot_end: string;
  slot_status: 'available' | 'occupied';
}

interface RawSession {
  id: number;
  enrollment_id: number;
  instructor_id: number;
  vehicle_id: number;
  class_number: number | null;
  scheduled_at: string;
  status: string;
  enrollments: {
    students: {
      users: { first_names: string; paternal_last_name: string };
    };
  } | null;
}

interface RawInstructor {
  id: number;
  users: { first_names: string; paternal_last_name: string } | null;
}

interface RawVehicle {
  id: number;
  license_plate: string;
}

// ─── Facade ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AgendaFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);

  // ── Estado privado ─────────────────────────────────────────────────────────

  private readonly _weekStart = signal<string>(getMondayOfCurrentWeek());
  private readonly _weekData = signal<AgendaWeekData | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  private readonly _instructors = signal<AgendaInstructorFilter[]>([]);
  private readonly _selectedInstructorId = signal<number | null>(null);

  private readonly _agendableStudents = signal<AgendableStudent[]>([]);
  private readonly _studentsLoading = signal<boolean>(false);

  private readonly _selectedSlot = signal<AgendaSlot | null>(null);
  private readonly _isScheduling = signal<boolean>(false);

  /** Mapas de lookup para enriquecer slots con nombres (cargados en initialize) */
  private instructorMap = new Map<number, string>();
  private vehicleMap = new Map<number, string>();

  // ── Estado público (readonly) ──────────────────────────────────────────────

  readonly weekStart = this._weekStart.asReadonly();
  readonly weekData = this._weekData.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly instructors = this._instructors.asReadonly();
  readonly selectedInstructorId = this._selectedInstructorId.asReadonly();
  readonly agendableStudents = this._agendableStudents.asReadonly();
  readonly studentsLoading = this._studentsLoading.asReadonly();
  readonly selectedSlot = this._selectedSlot.asReadonly();
  readonly isScheduling = this._isScheduling.asReadonly();

  readonly kpis = computed(() => this._weekData()?.kpis ?? null);
  readonly timeRows = computed(() => this._weekData()?.timeRows ?? []);
  readonly weekLabel = computed(() => this._weekData()?.weekLabel ?? '');

  readonly isCurrentWeek = computed(() => this._weekStart() === getMondayOfCurrentWeek());

  /**
   * Days filtrados por instructor seleccionado.
   * Si no hay filtro, devuelve todos los días.
   */
  readonly filteredDays = computed(() => {
    const data = this._weekData();
    if (!data) return [];
    const instructorId = this._selectedInstructorId();
    if (!instructorId) return data.days;
    return data.days.map((day) => ({
      ...day,
      slots: day.slots.filter((s) => s.instructorId === instructorId),
    }));
  });

  // ── Acciones ───────────────────────────────────────────────────────────────

  /**
   * Carga instructores, vehículos y la semana actual.
   * Llamar desde el Smart component en ngOnInit.
   */
  async initialize(): Promise<void> {
    await Promise.all([this.loadLookupMaps(), this.loadInstructors()]);
    await this.loadWeek();
  }

  async loadWeek(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);
    try {
      const weekStart = this._weekStart();
      const weekEnd = addDays(weekStart, 4); // Viernes
      const rangeStart = `${weekStart}T00:00:00Z`;
      const rangeEnd = `${addDays(weekStart, 7)}T06:00:00Z`; // Siguiente lunes 06:00 UTC

      const [slotsResult, sessionsResult] = await Promise.all([
        this.fetchAvailableSlots(rangeStart, rangeEnd),
        this.fetchSessions(rangeStart, rangeEnd),
      ]);

      this._weekData.set(this.buildWeekData(weekStart, weekEnd, slotsResult, sessionsResult));
    } catch {
      this._error.set('Error al cargar la agenda. Intenta de nuevo.');
    } finally {
      this._isLoading.set(false);
    }
  }

  goToNextWeek(): void {
    this._weekStart.update((d) => addDays(d, 7));
    this.loadWeek();
  }

  goToPrevWeek(): void {
    this._weekStart.update((d) => addDays(d, -7));
    this.loadWeek();
  }

  goToToday(): void {
    this._weekStart.set(getMondayOfCurrentWeek());
    this.loadWeek();
  }

  setInstructorFilter(id: number | null): void {
    this._selectedInstructorId.set(id);
  }

  setSelectedSlot(slot: AgendaSlot | null): void {
    this._selectedSlot.set(slot);
  }

  async loadAgendableStudents(): Promise<void> {
    const branchId = this.auth.currentUser()?.branchId;
    if (!branchId) return;

    this._studentsLoading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('enrollments')
        .select(
          `
          id,
          courses!inner ( name, practical_hours ),
          students!inner (
            users!inner ( first_names, paternal_last_name )
          ),
          class_b_sessions ( id, status )
        `,
        )
        .eq('status', 'active')
        .eq('branch_id', branchId);

      if (error || !data) return;

      const students: AgendableStudent[] = [];

      for (const enrollment of data as any[]) {
        const practicalHours = enrollment.courses?.practical_hours ?? 0;
        if (!practicalHours) continue; // Solo clase B (tiene horas prácticas)

        const totalSessions = Math.round((practicalHours * 60) / 45);
        const activeSessions: any[] = enrollment.class_b_sessions ?? [];
        const scheduledSessions = activeSessions.filter(
          (s) => s.status !== 'cancelled' && s.status !== 'no_show',
        ).length;
        const remainingSessions = Math.max(0, totalSessions - scheduledSessions);

        if (remainingSessions <= 0) continue;

        const user = enrollment.students?.users;
        const studentName = user ? `${user.first_names} ${user.paternal_last_name}` : 'Sin nombre';

        students.push({
          enrollmentId: enrollment.id,
          studentName,
          courseName: enrollment.courses?.name ?? '',
          totalSessions,
          scheduledSessions,
          remainingSessions,
        });
      }

      this._agendableStudents.set(
        students.sort((a, b) => a.studentName.localeCompare(b.studentName)),
      );
    } finally {
      this._studentsLoading.set(false);
    }
  }

  async scheduleClass(
    enrollmentId: number,
    slotId: string,
    instructorId: number,
    vehicleId: number,
  ): Promise<boolean> {
    this._isScheduling.set(true);
    try {
      const { error } = await this.supabase.client.from('class_b_sessions').insert({
        enrollment_id: enrollmentId,
        instructor_id: instructorId,
        vehicle_id: vehicleId,
        scheduled_at: slotId,
        status: 'scheduled',
        registered_by: this.auth.currentUser()?.dbId ?? null,
      });

      if (error) {
        this._error.set('Error al agendar la clase: ' + error.message);
        return false;
      }

      this._selectedSlot.set(null);
      await this.loadWeek();
      await this.loadAgendableStudents();
      return true;
    } finally {
      this._isScheduling.set(false);
    }
  }

  async cancelClass(sessionId: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('class_b_sessions')
      .update({ status: 'cancelled' })
      .eq('id', sessionId);

    if (!error) {
      await this.loadWeek();
    }
  }

  // ── Queries privadas ───────────────────────────────────────────────────────

  private async fetchAvailableSlots(rangeStart: string, rangeEnd: string): Promise<RawSlot[]> {
    const { data } = await this.supabase.client
      .from('v_class_b_schedule_availability')
      .select('instructor_id, vehicle_id, slot_start, slot_end, slot_status')
      .eq('slot_status', 'available')
      .gte('slot_start', rangeStart)
      .lt('slot_start', rangeEnd)
      .order('slot_start', { ascending: true });
    return (data as RawSlot[]) ?? [];
  }

  private async fetchSessions(rangeStart: string, rangeEnd: string): Promise<RawSession[]> {
    const { data } = await this.supabase.client
      .from('class_b_sessions')
      .select(
        `
        id, enrollment_id, instructor_id, vehicle_id,
        class_number, scheduled_at, status,
        enrollments!inner (
          students!inner (
            users!inner ( first_names, paternal_last_name )
          )
        )
      `,
      )
      .gte('scheduled_at', rangeStart)
      .lt('scheduled_at', rangeEnd)
      .neq('status', 'cancelled');
    return (data as unknown as RawSession[]) ?? [];
  }

  private async loadLookupMaps(): Promise<void> {
    const branchId = this.auth.currentUser()?.branchId;

    const [instrResult, vehResult] = await Promise.all([
      this.supabase.client
        .from('instructors')
        .select('id, users!inner ( first_names, paternal_last_name )')
        .eq('active', true),
      this.supabase.client
        .from('vehicles')
        .select('id, license_plate')
        .eq('branch_id', branchId ?? 0),
    ]);

    this.instructorMap.clear();
    for (const i of (instrResult.data as unknown as RawInstructor[]) ?? []) {
      if (i.users) {
        this.instructorMap.set(i.id, `${i.users.first_names} ${i.users.paternal_last_name}`);
      }
    }

    this.vehicleMap.clear();
    for (const v of (vehResult.data as unknown as RawVehicle[]) ?? []) {
      this.vehicleMap.set(v.id, v.license_plate);
    }
  }

  private async loadInstructors(): Promise<void> {
    const { data } = await this.supabase.client
      .from('instructors')
      .select('id, users!inner ( first_names, paternal_last_name )')
      .eq('active', true)
      .neq('type', 'theory');

    const filters: AgendaInstructorFilter[] = ((data as unknown as RawInstructor[]) ?? []).map(
      (i) => ({
        id: i.id,
        name: i.users
          ? `${i.users.first_names} ${i.users.paternal_last_name}`
          : `Instructor ${i.id}`,
      }),
    );

    this._instructors.set(filters);
  }

  // ── Construcción de la estructura semanal ─────────────────────────────────

  private buildWeekData(
    weekStart: string,
    weekEnd: string,
    availableSlots: RawSlot[],
    sessions: RawSession[],
  ): AgendaWeekData {
    // Build lookup: instructor+slot_start → session
    const sessionMap = new Map<string, RawSession>();
    for (const s of sessions) {
      const key = `${s.instructor_id}_${s.scheduled_at}`;
      sessionMap.set(key, s);
    }

    // Combine available slots + sessions into AgendaSlot[]
    const allSlots: AgendaSlot[] = [];
    const seenSessionIds = new Set<number>();

    // 1. Available slots from view
    for (const raw of availableSlots) {
      const date = tsToDate(raw.slot_start);
      allSlots.push({
        id: raw.slot_start,
        date,
        startTime: tsToTime(raw.slot_start),
        endTime: tsToTime(raw.slot_end),
        status: 'available',
        instructorId: raw.instructor_id,
        instructorName: this.instructorMap.get(raw.instructor_id) ?? `#${raw.instructor_id}`,
        vehicleId: raw.vehicle_id,
        vehiclePlate: this.vehicleMap.get(raw.vehicle_id) ?? `V${raw.vehicle_id}`,
      });
    }

    // 2. Sessions (occupied/completed/etc.)
    for (const s of sessions) {
      seenSessionIds.add(s.id);
      const date = tsToDate(s.scheduled_at);
      const user = s.enrollments?.students?.users;
      const studentName = user ? `${user.first_names} ${user.paternal_last_name}` : 'Alumno';

      allSlots.push({
        id: s.scheduled_at,
        date,
        startTime: tsToTime(s.scheduled_at),
        endTime: '', // computed below
        status: this.mapSessionStatus(s.status),
        instructorId: s.instructor_id,
        instructorName: this.instructorMap.get(s.instructor_id) ?? `#${s.instructor_id}`,
        vehicleId: s.vehicle_id,
        vehiclePlate: this.vehicleMap.get(s.vehicle_id) ?? `V${s.vehicle_id}`,
        sessionId: s.id,
        enrollmentId: s.enrollment_id,
        studentName,
        classNumber: s.class_number ?? undefined,
      });
    }

    // Compute endTime for sessions (startTime + 45min)
    for (const slot of allSlots) {
      if (!slot.endTime && slot.startTime) {
        slot.endTime = addMinutesToTime(slot.startTime, 45);
      }
    }

    // Collect unique time rows across all slots
    const timeRowSet = new Set<string>();
    for (const s of allSlots) timeRowSet.add(s.startTime);
    const timeRows = [...timeRowSet].sort();

    // Generate Mon–Fri columns
    const days: AgendaDayColumn[] = [];
    for (let i = 0; i < 5; i++) {
      const date = addDays(weekStart, i);
      days.push({
        date,
        label: buildDayLabel(date),
        isToday: isToday(date),
        slots: allSlots.filter((s) => s.date === date),
      });
    }

    // KPIs
    const kpis = this.computeKpis(allSlots, availableSlots);

    // Week label
    const startDay = new Date(weekStart + 'T12:00:00').toLocaleDateString('es', {
      day: 'numeric',
      month: 'short',
    });
    const endDay = new Date(weekEnd + 'T12:00:00').toLocaleDateString('es', {
      day: 'numeric',
      month: 'short',
    });
    const weekLabel = `${startDay} – ${endDay}`;

    return { weekStart, weekEnd, weekLabel, days, timeRows, kpis };
  }

  private computeKpis(allSlots: AgendaSlot[], availableSlots: RawSlot[]): AgendaWeekKpis {
    const booked = allSlots.filter((s) => s.status === 'scheduled' || s.status === 'in_progress');
    const completed = allSlots.filter((s) => s.status === 'completed');

    const instructoresDisponibles = new Set(availableSlots.map((s) => s.instructor_id)).size;

    const vehiculosDisponibles = new Set(availableSlots.map((s) => s.vehicle_id)).size;

    return {
      clasesAgendadas: booked.length,
      clasesCompletadas: completed.length,
      instructoresDisponibles,
      vehiculosDisponibles,
    };
  }

  private mapSessionStatus(raw: string): AgendaSlotStatus {
    const map: Record<string, AgendaSlotStatus> = {
      scheduled: 'scheduled',
      in_progress: 'in_progress',
      completed: 'completed',
      cancelled: 'cancelled',
      no_show: 'no_show',
    };
    return map[raw] ?? 'scheduled';
  }
}

// ─── Helper extra ─────────────────────────────────────────────────────────

function addMinutesToTime(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
