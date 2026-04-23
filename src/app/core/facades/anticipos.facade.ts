import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import type {
  AnticipoCuentaCorriente,
  AnticipoHistorial,
  AnticiposKpis,
  AdvanceStatus,
  InstructorOption,
  RegistrarAnticipoPayload,
} from '@core/models/ui/anticipos.model';

// ─── Helpers puros ────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  theory: 'Teórico',
  practice: 'Práctico',
  both: 'Teórico y Práctico',
};

export function tipoLabel(tipo: string | null): string {
  if (!tipo) return '—';
  return TIPO_LABELS[tipo] ?? tipo;
}

export function mapStatus(raw: string | null): AdvanceStatus {
  if (raw === 'discounted' || raw === 'deducted') return 'discounted';
  return 'pending';
}

// ─── Facade ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AnticiosFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly toast = inject(ToastService);

  // ── Estado privado ────────────────────────────────────────────────────────
  private readonly _historial = signal<AnticipoHistorial[]>([]);
  private readonly _cuentaCorriente = signal<AnticipoCuentaCorriente[]>([]);
  private readonly _instructores = signal<InstructorOption[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private _initialized = false;

  // ── Estado público ────────────────────────────────────────────────────────
  readonly historial = this._historial.asReadonly();
  readonly cuentaCorriente = this._cuentaCorriente.asReadonly();
  readonly instructores = this._instructores.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();

  // ── KPIs computed ─────────────────────────────────────────────────────────
  readonly kpis = computed<AnticiposKpis>(() => {
    const rows = this._historial();
    const totalPendiente = rows
      .filter((r) => r.estado === 'pending')
      .reduce((s, r) => s + r.monto, 0);
    const totalHistorico = rows.reduce((s, r) => s + r.monto, 0);
    const totalDescontado = rows
      .filter((r) => r.estado !== 'pending')
      .reduce((s, r) => s + r.monto, 0);
    const instructoresConSaldo = new Set(
      this._cuentaCorriente()
        .filter((c) => c.saldoPendiente > 0)
        .map((c) => c.instructorId),
    ).size;
    return { totalPendiente, instructoresConSaldo, totalHistorico, totalDescontado };
  });

  // ── SWR Initialization ────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this._initialized) {
      void this.refreshSilently();
      return;
    }
    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchData();
      this._initialized = true;
    } catch {
      this._error.set('Error al cargar los anticipos.');
    } finally {
      this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchData();
    } catch {
      // Swallowed — datos stale siguen visibles
    }
  }

  // ── Fetch de datos ────────────────────────────────────────────────────────

  private async fetchData(): Promise<void> {
    const [advancesRes, instructorsRes] = await Promise.all([
      this.supabase.client
        .from('instructor_advances')
        .select(
          'id, date, amount, reason, description, status, instructor_id, instructors!inner(id, type, users!inner(first_names, paternal_last_name))',
        )
        .order('date', { ascending: false }),
      this.supabase.client
        .from('instructors')
        .select('id, type, users!inner(first_names, paternal_last_name)')
        .eq('active', true)
        .order('users(paternal_last_name)', { ascending: true }),
    ]);

    if (advancesRes.error) throw advancesRes.error;

    const advances = advancesRes.data ?? [];

    // ── Historial ──────────────────────────────────────────────────────────
    const historial: AnticipoHistorial[] = advances.map((adv) => {
      const instr = adv.instructors as any;
      const u = Array.isArray(instr?.users) ? instr.users[0] : instr?.users;
      const nombre = u ? `${u.first_names ?? ''} ${u.paternal_last_name ?? ''}`.trim() : '—';
      const motivo = adv.description?.trim() || labelReason(adv.reason);
      return {
        id: adv.id,
        fecha: adv.date,
        instructorNombre: nombre,
        motivo,
        monto: adv.amount,
        estado: mapStatus(adv.status),
      };
    });
    this._historial.set(historial);

    // ── Cuenta Corriente (agrupada por instructor) ────────────────────────
    const mapaInstructor = new Map<
      number,
      { nombre: string; tipo: string | null; anticipos: typeof advances }
    >();
    for (const adv of advances) {
      const instr = adv.instructors as any;
      const u = Array.isArray(instr?.users) ? instr.users[0] : instr?.users;
      const nombre = u ? `${u.first_names ?? ''} ${u.paternal_last_name ?? ''}`.trim() : '—';
      if (!mapaInstructor.has(adv.instructor_id)) {
        mapaInstructor.set(adv.instructor_id, {
          nombre,
          tipo: instr?.type ?? null,
          anticipos: [],
        });
      }
      mapaInstructor.get(adv.instructor_id)!.anticipos.push(adv);
    }

    // Agregar instructores sin anticipos (saldo $0, Al día)
    for (const instr of instructorsRes.data ?? []) {
      if (!mapaInstructor.has(instr.id)) {
        const u = Array.isArray((instr as any).users)
          ? (instr as any).users[0]
          : (instr as any).users;
        const nombre = u ? `${u.first_names ?? ''} ${u.paternal_last_name ?? ''}`.trim() : '—';
        mapaInstructor.set(instr.id, { nombre, tipo: instr.type ?? null, anticipos: [] });
      }
    }

    const cuentaCorriente: AnticipoCuentaCorriente[] = Array.from(mapaInstructor.entries()).map(
      ([instructorId, { nombre, tipo, anticipos }]) => {
        const anticiposTotales = anticipos.reduce((s, a) => s + a.amount, 0);
        const saldoPendiente = anticipos
          .filter((a) => mapStatus(a.status) === 'pending')
          .reduce((s, a) => s + a.amount, 0);
        const ultimoAnticipo = anticipos.length > 0 ? anticipos[0].date : null;
        return {
          instructorId,
          nombre,
          tipo: tipo as any,
          tipoLabel: tipoLabel(tipo),
          anticiposTotales,
          saldoPendiente,
          ultimoAnticipo,
          estado: saldoPendiente > 0 ? 'pendiente' : 'al_dia',
        };
      },
    );

    // Ordenar: primero los que tienen saldo pendiente, luego por nombre
    cuentaCorriente.sort((a, b) => {
      if (a.saldoPendiente > 0 && b.saldoPendiente === 0) return -1;
      if (a.saldoPendiente === 0 && b.saldoPendiente > 0) return 1;
      return a.nombre.localeCompare(b.nombre);
    });

    this._cuentaCorriente.set(cuentaCorriente);

    // ── Opciones de instructores para el formulario ───────────────────────
    const instructorOptions: InstructorOption[] = Array.from(mapaInstructor.entries()).map(
      ([id, { nombre }]) => ({ id, nombre }),
    );
    instructorOptions.sort((a, b) => a.nombre.localeCompare(b.nombre));
    this._instructores.set(instructorOptions);
  }

  // ── Mutaciones ────────────────────────────────────────────────────────────

  async registrarAnticipo(payload: RegistrarAnticipoPayload): Promise<boolean> {
    const user = this.auth.currentUser();
    if (!user) {
      this.toast.error('No hay sesión activa.');
      return false;
    }
    this._isSaving.set(true);
    this._error.set(null);
    try {
      const { error } = await this.supabase.client.from('instructor_advances').insert({
        instructor_id: payload.instructorId,
        date: payload.date,
        amount: payload.amount,
        reason: payload.reason || null,
        description: payload.description || null,
        status: 'pending',
        registered_by: user.dbId ?? null,
      });
      if (error) throw error;
      this.toast.success('Anticipo registrado correctamente.');
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar el anticipo.';
      this._error.set(msg);
      this.toast.error(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }
}

// ─── Utilidad local ───────────────────────────────────────────────────────────

function labelReason(reason: string | null): string {
  const map: Record<string, string> = {
    salary: 'Anticipo de sueldo',
    allowance: 'Anticipo viático',
    materials: 'Anticipo materiales',
    other: 'Anticipo varios',
  };
  return reason ? (map[reason] ?? reason) : 'Anticipo';
}
