import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import type {
  LiquidacionRow,
  LiquidacionesKpis,
  PagoInstructorPayload,
} from '@core/models/ui/liquidaciones.model';

// ─── Constantes ───────────────────────────────────────────────────────────────

const AMOUNT_PER_HOUR_DEFAULT = 5_000;

const AVATAR_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#14b8a6',
];

// ─── Helpers puros ────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// ─── Facade ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LiquidacionesFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly toast = inject(ToastService);

  // ── Estado privado ────────────────────────────────────────────────────────
  private readonly _liquidaciones = signal<LiquidacionRow[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // ── SWR State ────────────────────────────────────────────────────────────
  private _initialized = false;
  private _lastMonth: number | null = null;
  private _lastYear: number | null = null;
  private _lastBranchId: number | null = null;

  // ── Navegación de mes ─────────────────────────────────────────────────────
  private readonly _mesActual = signal<number>(new Date().getMonth() + 1);
  private readonly _anioActual = signal<number>(new Date().getFullYear());

  // ── Realtime ─────────────────────────────────────────────────────────────
  private _realtimeChannel: any | null = null;

  // ── Estado público ────────────────────────────────────────────────────────
  readonly liquidaciones = this._liquidaciones.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly mesActual = this._mesActual.asReadonly();
  readonly anioActual = this._anioActual.asReadonly();
  readonly selectedRow = signal<LiquidacionRow | null>(null);

  // ── Computed KPIs ─────────────────────────────────────────────────────────
  readonly kpis = computed<LiquidacionesKpis>(() => {
    const rows = this._liquidaciones();
    return {
      totalNomina: rows.reduce((s, r) => s + r.totalBaseAmount, 0),
      totalAnticipos: rows.reduce((s, r) => s + r.totalAdvances, 0),
      totalPagados: rows.filter((r) => r.status === 'paid').length,
      totalInstructores: rows.length,
    };
  });

  // ── Navegación ────────────────────────────────────────────────────────────

  mesAnterior(): void {
    let mes = this._mesActual();
    let anio = this._anioActual();
    if (mes === 1) {
      mes = 12;
      anio--;
    } else {
      mes--;
    }
    this._mesActual.set(mes);
    this._anioActual.set(anio);
    this.initialize();
  }

  mesSiguiente(): void {
    let mes = this._mesActual();
    let anio = this._anioActual();
    if (mes === 12) {
      mes = 1;
      anio++;
    } else {
      mes++;
    }
    this._mesActual.set(mes);
    this._anioActual.set(anio);
    this.initialize();
  }

  // ── Selección Contextual ──────────────────────────────────────────────────

  seleccionarParaPago(row: LiquidacionRow | null): void {
    this.selectedRow.set(row);
  }

  // ── Sincronización Realtime ──────────────────────────────────────────────

  /**
   * Suscribe la Facade a cambios en Supabase para las tablas de pagos y anticipos.
   */
  setupRealtime(): void {
    if (this._realtimeChannel) return;

    this._realtimeChannel = this.supabase.client
      .channel('liquidaciones-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'instructor_monthly_payments' },
        () => {
          console.log('[LiquidacionesFacade] Realtime update: Payments changed');
          void this.refreshSilently();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'instructor_advances' },
        () => {
          console.log('[LiquidacionesFacade] Realtime update: Advances changed');
          void this.refreshSilently();
        },
      )
      .subscribe();
  }

  destroyRealtime(): void {
    if (this._realtimeChannel) {
      void this.supabase.client.removeChannel(this._realtimeChannel);
      this._realtimeChannel = null;
    }
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  /**
   * SWR Initialization:
   * First call triggers isLoading(true). Subsequent calls refresh silently.
   */
  async initialize(): Promise<void> {
    const mes = this._mesActual();
    const anio = this._anioActual();
    const branchId = this.auth.currentUser()?.branchId ?? null;

    // Aseguramos suscripción realtime una sola vez
    this.setupRealtime();

    const isSameContext =
      this._initialized &&
      mes === this._lastMonth &&
      anio === this._lastYear &&
      branchId === this._lastBranchId;

    if (isSameContext) {
      void this.refreshSilently();
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchLiquidacionesData(mes, anio, branchId);
      this._initialized = true;
      this._lastMonth = mes;
      this._lastYear = anio;
      this._lastBranchId = branchId;
    } catch {
      this._error.set('Error en la carga inicial de liquidaciones.');
    } finally {
      this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      const mes = this._mesActual();
      const anio = this._anioActual();
      const branchId = this.auth.currentUser()?.branchId ?? null;
      await this.fetchLiquidacionesData(mes, anio, branchId);
      this._lastMonth = mes;
      this._lastYear = anio;
      this._lastBranchId = branchId;
    } catch {
      // Swallowed
    }
  }

  /** Legacy wrapper */
  async cargarLiquidaciones(): Promise<void> {
    return this.initialize();
  }

  private async fetchLiquidacionesData(
    mes: number,
    anio: number,
    branchId: number | null,
  ): Promise<void> {
    try {
      const mm = String(mes).padStart(2, '0');
      const lastDay = new Date(anio, mes, 0).getDate();
      const fechaInicio = `${anio}-${mm}-01`;
      const fechaFin = `${anio}-${mm}-${String(lastDay).padStart(2, '0')}`;

      const [instrRes, hoursRes, advancesRes, paymentsRes] = await Promise.all([
        this.supabase.client
          .from('instructors')
          .select('id, user_id, users(id, first_names, paternal_last_name, rut, branch_id)'),
        this.supabase.client
          .from('instructor_monthly_hours')
          .select('instructor_id, total_equivalent')
          .eq('period', `${anio}-${mm}`),
        this.supabase.client
          .from('instructor_advances')
          .select('instructor_id, amount')
          .gte('date', fechaInicio)
          .lte('date', fechaFin),
        this.supabase.client
          .from('instructor_monthly_payments')
          .select('*')
          .eq('period', `${anio}-${mm}`),
      ]);

      if (instrRes.error) throw instrRes.error;

      const hoursMap = new Map<number, number>(
        (hoursRes.data ?? []).map((h) => [h.instructor_id, h.total_equivalent ?? 0]),
      );

      const advancesMap = new Map<number, number>();
      for (const adv of advancesRes.data ?? []) {
        advancesMap.set(adv.instructor_id, (advancesMap.get(adv.instructor_id) ?? 0) + adv.amount);
      }

      const paymentsMap = new Map<number, any>(
        (paymentsRes.data ?? []).map((p) => [p.instructor_id, p]),
      );

      const rows: LiquidacionRow[] = (instrRes.data ?? [])
        .filter((instr) => {
          const u = instr.users as any;
          const bId = Array.isArray(u) ? u[0]?.branch_id : u?.branch_id;
          if (branchId && bId !== branchId) return false;

          const totalHours = hoursMap.get(instr.id) ?? 0;
          const totalAdvances = advancesMap.get(instr.id) ?? 0;
          const payment = paymentsMap.get(instr.id);

          // ONLY include instructors that have activity this month:
          // either they worked hours, got an advance, or have a payment record.
          return totalHours > 0 || totalAdvances > 0 || !!payment;
        })
        .map((instr) => {
          const rawU = instr.users as any;
          const u = Array.isArray(rawU) ? rawU[0] : rawU;
          const nombre = `${u?.first_names ?? ''} ${u?.paternal_last_name ?? ''}`.trim() || '—';
          const totalHours = hoursMap.get(instr.id) ?? 0;
          const totalAdvances = advancesMap.get(instr.id) ?? 0;
          const payment = paymentsMap.get(instr.id);
          const amountPerHour = payment?.amount_per_hour ?? AMOUNT_PER_HOUR_DEFAULT;
          const totalBaseAmount = totalHours * amountPerHour;
          const finalPaymentAmount = Math.max(0, totalBaseAmount - totalAdvances);

          return {
            instructorId: instr.id,
            userId: u?.id ?? 0,
            nombre,
            rut: u?.rut ?? '—',
            initials: getInitials(nombre),
            avatarColor: getAvatarColor(nombre),
            totalHours,
            amountPerHour,
            totalBaseAmount,
            totalAdvances,
            finalPaymentAmount,
            status: payment?.payment_status === 'paid' ? 'paid' : 'pending',
            paymentId: payment?.id,
            paymentDate: payment?.paid_at ?? undefined,
          };
        });

      this._liquidaciones.set(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar liquidaciones.';
      this._error.set(msg);
      this.toast.error(msg);
      throw err;
    }
  }

  // ── Mutaciones ────────────────────────────────────────────────────────────

  async registrarPago(row: LiquidacionRow, payload: PagoInstructorPayload): Promise<boolean> {
    const user = this.auth.currentUser();
    if (!user) {
      this.toast.error('No hay sesión activa.');
      return false;
    }

    this._isSaving.set(true);
    this._error.set(null);

    try {
      const mes = this._mesActual();
      const anio = this._anioActual();
      const mm = String(mes).padStart(2, '0');
      const lastDay = new Date(anio, mes, 0).getDate();

      const record = {
        instructor_id: row.instructorId,
        period: `${anio}-${mm}`,
        base_salary: row.totalBaseAmount,
        advances_deducted: row.totalAdvances,
        net_payment: row.totalBaseAmount - row.totalAdvances,
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: user.dbId ?? null,
      };

      const { error: payErr } = await this.supabase.client
        .from('instructor_monthly_payments')
        .upsert(record, { onConflict: 'instructor_id,period' });

      if (payErr) throw payErr;

      await this.supabase.client
        .from('instructor_advances')
        .update({ status: 'discounted' })
        .eq('instructor_id', row.instructorId)
        .gte('date', `${anio}-${mm}-01`)
        .lte('date', `${anio}-${mm}-${String(lastDay).padStart(2, '0')}`);

      this.toast.success(`Liquidación de ${row.nombre} registrada correctamente.`);
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar el pago.';
      this._error.set(msg);
      this.toast.error(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  async deshacerPago(row: LiquidacionRow): Promise<boolean> {
    if (!row.paymentId) return false;

    this._isSaving.set(true);
    this._error.set(null);

    try {
      const mes = this._mesActual();
      const anio = this._anioActual();
      const mm = String(mes).padStart(2, '0');
      const lastDay = new Date(anio, mes, 0).getDate();

      const { error: delErr } = await this.supabase.client
        .from('instructor_monthly_payments')
        .delete()
        .eq('instructor_id', row.instructorId)
        .eq('period', `${anio}-${mm}`);

      if (delErr) throw delErr;

      await this.supabase.client
        .from('instructor_advances')
        .update({ status: 'pending' })
        .eq('instructor_id', row.instructorId)
        .gte('date', `${anio}-${mm}-01`)
        .lte('date', `${anio}-${mm}-${String(lastDay).padStart(2, '0')}`);

      this.toast.success(`Pago de ${row.nombre} revertido.`);
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al revertir el pago.';
      this._error.set(msg);
      this.toast.error(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }
}
