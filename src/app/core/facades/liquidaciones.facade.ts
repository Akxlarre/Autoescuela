import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { toISODate } from '@core/utils/date.utils';
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

  // ── Navegación de mes ─────────────────────────────────────────────────────
  private readonly _mesActual = signal<number>(new Date().getMonth() + 1);
  private readonly _anioActual = signal<number>(new Date().getFullYear());

  // ── Estado público ────────────────────────────────────────────────────────
  readonly liquidaciones = this._liquidaciones.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly mesActual = this._mesActual.asReadonly();
  readonly anioActual = this._anioActual.asReadonly();

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
    this.cargarLiquidaciones();
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
    this.cargarLiquidaciones();
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  async cargarLiquidaciones(): Promise<void> {
    const mes = this._mesActual();
    const anio = this._anioActual();
    const branchId = this.auth.currentUser()?.branchId ?? null;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const mm = String(mes).padStart(2, '0');
      const lastDay = new Date(anio, mes, 0).getDate();
      const fechaInicio = `${anio}-${mm}-01`;
      const fechaFin = `${anio}-${mm}-${String(lastDay).padStart(2, '0')}`;

      // Parallel: instructores, horas, anticipos, pagos
      const [instrRes, hoursRes, advancesRes, paymentsRes] = await Promise.all([
        this.supabase.client
          .from('instructors')
          .select('id, user_id, users(id, first_names, paternal_last_name, rut, branch_id)'),

        this.supabase.client
          .from('instructor_monthly_hours')
          .select('instructor_id, total_hours')
          .eq('month', mes)
          .eq('year', anio),

        this.supabase.client
          .from('instructor_advances')
          .select('instructor_id, amount')
          .gte('date', fechaInicio)
          .lte('date', fechaFin),

        this.supabase.client
          .from('instructor_monthly_payments')
          .select('*')
          .eq('month', mes)
          .eq('year', anio),
      ]);

      if (instrRes.error) throw instrRes.error;

      // Mapas de lookup O(1)
      const hoursMap = new Map<number, number>(
        (hoursRes.data ?? []).map((h) => [h.instructor_id, h.total_hours]),
      );

      const advancesMap = new Map<number, number>();
      for (const adv of advancesRes.data ?? []) {
        advancesMap.set(adv.instructor_id, (advancesMap.get(adv.instructor_id) ?? 0) + adv.amount);
      }

      type PaymentRow = NonNullable<typeof paymentsRes.data>[number];
      const paymentsMap = new Map<number, PaymentRow>(
        (paymentsRes.data ?? []).map((p) => [p.instructor_id, p]),
      );

      type UserJoin = {
        id: number;
        first_names: string;
        paternal_last_name: string;
        rut: string;
        branch_id: number;
      } | null;

      const liquidaciones: LiquidacionRow[] = (instrRes.data ?? [])
        .filter((instr) => {
          const raw = instr.users;
          const u = (Array.isArray(raw) ? raw[0] : raw) as { branch_id?: number } | null;
          return !branchId || u?.branch_id === branchId;
        })
        .map((instr) => {
          const raw = instr.users;
          const u = (Array.isArray(raw) ? raw[0] : raw) as UserJoin;

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
            status: payment ? 'paid' : 'pending',
            paymentId: payment?.id,
            paymentMethod: payment?.payment_method,
            paymentDate: payment?.payment_date,
            transferCode: payment?.transfer_code,
          } satisfies LiquidacionRow;
        });

      this._liquidaciones.set(liquidaciones);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar liquidaciones.';
      this._error.set(msg);
      this.toast.error(msg);
    } finally {
      this._isLoading.set(false);
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
        month: mes,
        year: anio,
        total_hours: row.totalHours,
        amount_per_hour: row.amountPerHour,
        total_base_amount: row.totalBaseAmount,
        total_advances: row.totalAdvances,
        final_payment_amount: row.finalPaymentAmount,
        payment_method: payload.paymentMethod,
        transfer_code: payload.transferCode ?? null,
        status: 'paid',
        payment_date: toISODate(new Date()),
        paid_by: user.dbId ?? null,
      };

      const { error: payErr } = await this.supabase.client
        .from('instructor_monthly_payments')
        .upsert(record, { onConflict: 'instructor_id,month,year' });

      if (payErr) throw payErr;

      // Marcar anticipos del mes como descontados
      await this.supabase.client
        .from('instructor_advances')
        .update({ status: 'discounted' })
        .eq('instructor_id', row.instructorId)
        .gte('date', `${anio}-${mm}-01`)
        .lte('date', `${anio}-${mm}-${String(lastDay).padStart(2, '0')}`);

      this.toast.success(`Liquidación de ${row.nombre} registrada correctamente.`);
      await this.cargarLiquidaciones();
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
}
