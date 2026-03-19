import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import type { AlumnoDeudor } from '@core/models/ui/pagos.model';
import { toISODate } from '@core/utils/date.utils';

@Injectable({ providedIn: 'root' })
export class PagosFacade {
  private readonly supabase = inject(SupabaseService);

  // ══════════════════════════════════════════════════════════════════════════════
  // 1. ESTADO REACTIVO (Privado)
  // ══════════════════════════════════════════════════════════════════════════════

  private readonly _ingresosHoy = signal<number>(0);
  private readonly _ingresosMes = signal<number>(0);
  private readonly _boletasMes = signal<number>(0);
  private readonly _pagosPendientesTotales = signal<number>(0);
  private readonly _alumnosConDeuda = signal<AlumnoDeudor[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  /** SWR guard: evita re-fetch con skeleton en revisitas. */
  private _initialized = false;

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. ESTADO EXPUESTO (Público, solo lectura)
  // ══════════════════════════════════════════════════════════════════════════════

  readonly ingresosHoy = this._ingresosHoy.asReadonly();
  readonly ingresosMes = this._ingresosMes.asReadonly();
  readonly boletasMes = this._boletasMes.asReadonly();
  readonly pagosPendientesTotales = this._pagosPendientesTotales.asReadonly();
  readonly alumnosConDeuda = this._alumnosConDeuda.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Cantidad de alumnos con saldo pendiente (computed). */
  readonly totalDeudores = computed(() => this._alumnosConDeuda().length);

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. MÉTODOS DE ACCIÓN
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Inicializa el facade con patrón SWR.
   * Primera visita: muestra skeleton + carga datos.
   * Revisitas: datos cacheados visibles, refresca en background silencioso.
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    this._error.set(null);
    try {
      await this.fetchAll();
    } catch (err) {
      this._error.set('Error al cargar los datos de pagos.');
    } finally {
      this._isLoading.set(false);
    }
  }

  // ── Fetch compartido ─────────────────────────────────────────────────────────

  private async fetchAll(): Promise<void> {
    const today = toISODate(new Date());
    const [year, month] = today.split('-');
    const firstOfMonth = `${year}-${month}-01`;
    const lastOfMonth = toISODate(new Date(Number(year), Number(month), 0));

    await Promise.all([
      this.fetchIngresosHoy(today),
      this.fetchIngresosMes(firstOfMonth, lastOfMonth),
      this.fetchBoletasMes(firstOfMonth, lastOfMonth),
      this.fetchPagosPendientes(),
      this.fetchAlumnosConDeuda(),
    ]);
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchAll();
    } catch {
      // Fail silencioso — datos stale siguen visibles
    }
  }

  // ── Queries individuales ──────────────────────────────────────────────────────

  private async fetchIngresosHoy(today: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('payments')
      .select('total_amount')
      .eq('payment_date', today);

    if (error) throw error;
    const total = (data ?? []).reduce((acc, row) => acc + (row.total_amount ?? 0), 0);
    this._ingresosHoy.set(total);
  }

  private async fetchIngresosMes(firstOfMonth: string, lastOfMonth: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('payments')
      .select('total_amount')
      .gte('payment_date', firstOfMonth)
      .lte('payment_date', lastOfMonth);

    if (error) throw error;
    const total = (data ?? []).reduce((acc, row) => acc + (row.total_amount ?? 0), 0);
    this._ingresosMes.set(total);
  }

  private async fetchBoletasMes(firstOfMonth: string, lastOfMonth: string): Promise<void> {
    const { count, error } = await this.supabase.client
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .gte('payment_date', firstOfMonth)
      .lte('payment_date', lastOfMonth);

    if (error) throw error;
    this._boletasMes.set(count ?? 0);
  }

  private async fetchPagosPendientes(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('enrollments')
      .select('pending_balance')
      .gt('pending_balance', 0)
      .neq('status', 'draft');

    if (error) throw error;
    const total = (data ?? []).reduce((acc, row) => acc + (row.pending_balance ?? 0), 0);
    this._pagosPendientesTotales.set(total);
  }

  private async fetchAlumnosConDeuda(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('enrollments')
      .select(
        `
        id,
        base_price,
        discount,
        total_paid,
        pending_balance,
        students!inner(
          users!inner(
            first_names,
            paternal_last_name,
            rut
          )
        )
      `,
      )
      .gt('pending_balance', 0)
      .neq('status', 'draft')
      .order('pending_balance', { ascending: false });

    if (error) throw error;

    const deudores: AlumnoDeudor[] = (data ?? []).map((row: any) => {
      const user = row.students?.users;
      const totalAPagar = (row.base_price ?? 0) - (row.discount ?? 0);
      return {
        enrollmentId: row.id,
        alumno: user ? `${user.first_names ?? ''} ${user.paternal_last_name ?? ''}`.trim() : '—',
        rut: user?.rut ?? '—',
        totalAPagar,
        pagado: row.total_paid ?? 0,
        saldo: row.pending_balance ?? 0,
      };
    });

    this._alumnosConDeuda.set(deudores);
  }
}
