import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { chileDayRange, chileToday, formatChileTime } from '@core/utils/chile-time.utils';
import { downloadExcel } from '@core/utils/excel.utils';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import { mapConcepto } from '@core/utils/payment-concept.utils';
import { assertWriteOk, toFriendlyDbMessage } from '@core/utils/db-error.utils';
import type {
  IngresoRow,
  EgresoRow,
  CierrePayload,
  EgresoFormData,
} from '@core/models/ui/cuadratura.model';
import type { Payment } from '@core/models/dto/payment.model';
import type { Expense } from '@core/models/dto/expense.model';
import type { InstructorAdvance } from '@core/models/dto/instructor-advance.model';
import type { CashClosing } from '@core/models/dto/cash-closing.model';

// ─── Helpers puros ────────────────────────────────────────────────────────────

/** Datos de la matrícula asociada, traídos vía join para enriquecer la glosa (fix-211-m). */
export interface PaymentEnrollmentInfo {
  number: string | null;
  license_group: string | null;
}

function buildPaymentGlosa(
  type: string | null | undefined,
  enrollment?: PaymentEnrollmentInfo | null,
): string {
  const concepto = mapConcepto(type) ?? '—';
  if (concepto !== 'Matrícula' || !enrollment?.number) return concepto;
  const tipoCurso = enrollment.license_group === 'professional' ? 'Clase Profesional' : 'Clase B';
  return `Matrícula #${enrollment.number} — ${tipoCurso}`;
}

export function mapPaymentToIngreso(
  p: Payment & { enrollments?: PaymentEnrollmentInfo | null },
): IngresoRow {
  return {
    id: p.id,
    source: 'payment',
    enrollmentId: p.enrollment_id ?? null,
    nBoleta: p.document_number ?? null,
    glosa: buildPaymentGlosa(p.type, p.enrollments),
    claseB: p.cash_amount ?? 0,
    claseA: p.transfer_amount ?? 0,
    sence: p.voucher_amount ?? 0,
    otros: p.card_amount ?? 0,
    total: p.total_amount ?? 0,
  };
}

/** Cobro de curso singular (standalone_course_enrollments pagado hoy). */
export interface SingularSaleDto {
  id: number;
  amount_paid: number | null;
  payment_method: string | null;
  courseName: string;
  studentName: string;
}

/**
 * Mapea un cobro de curso singular a la fila de cuadratura.
 * Buckets por método de pago (mismas columnas legacy que payments):
 * efectivo → claseB (cash) · transferencia → claseA · tarjeta → otros · sence → sence.
 */
export function mapSingularSaleToIngreso(s: SingularSaleDto): IngresoRow {
  const monto = s.amount_paid ?? 0;
  const method = s.payment_method ?? 'efectivo';
  return {
    id: s.id,
    source: 'singular',
    enrollmentId: null,
    nBoleta: null,
    glosa: `Curso singular: ${s.courseName} — ${s.studentName}`,
    claseB: method === 'efectivo' ? monto : 0,
    claseA: method === 'transferencia' ? monto : 0,
    sence: method === 'sence' ? monto : 0,
    otros: method === 'tarjeta' ? monto : 0,
    total: monto,
  };
}

/** Venta de Servicio Especial cobrada hoy (special_service_sales, fix-024-i). */
export interface SpecialServiceSaleIngresoDto {
  id: number;
  price: number;
  serviceName: string | null;
  clientName: string;
  /** N° de boleta emitida (opcional), migración 20260813070000 (fix-025-i). */
  documentNumber: string | null;
}

/**
 * Mapea una venta de Servicio Especial cobrada a la fila de cuadratura.
 * La tabla no registra método de pago (a diferencia de payments/singular) — un servicio
 * especial no es una clase de manejo, así que se bucketea completo a "otros" (fix-025-i;
 * antes iba a "efectivo"/claseB, decisión revertida a pedido del usuario).
 */
export function mapSpecialServiceSaleToIngreso(s: SpecialServiceSaleIngresoDto): IngresoRow {
  const monto = s.price ?? 0;
  return {
    id: s.id,
    source: 'special_service',
    enrollmentId: null,
    nBoleta: s.documentNumber ?? null,
    glosa: `Servicio especial: ${s.serviceName ?? '—'} — ${s.clientName}`,
    claseB: 0,
    claseA: 0,
    sence: 0,
    otros: monto,
    total: monto,
  };
}

function mapExpenseToEgreso(e: Expense): EgresoRow {
  return {
    id: e.id,
    tipo: 'expense',
    category: e.category ?? null,
    descripcion: e.description,
    monto: e.amount,
    paymentMethod: e.payment_method,
  };
}

function mapAdvanceToEgreso(a: InstructorAdvance): EgresoRow {
  return {
    id: a.id,
    tipo: 'advance',
    category: null,
    descripcion: a.reason ?? a.description ?? 'Anticipo instructor',
    monto: a.amount,
    paymentMethod: a.payment_method,
  };
}

// ─── Facade ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CuadraturaFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly toast = inject(ToastService);

  // ── 1. ESTADO REACTIVO (Privado) ────────────────────────────────────────────
  // Sin default asumido (hotfix-002-i): la caja no siempre arranca con $50.000 —
  // el arqueo es opcional y el usuario ingresa el fondo real de ese día, si aplica.
  readonly fondoInicial = signal<number>(0);
  /** Preset de tipo consumido una sola vez por RegistrarEgresoDrawerComponent al abrirse (fix-006-i). */
  readonly egresoTipoPreset = signal<EgresoFormData['tipo'] | null>(null);

  // ── Estado del Arqueo Físico (spec 0004-i) ─────────────────────────────────
  // Sube desde cuadratura-content.component.ts: el conteo de billetes/monedas ahora vive en
  // ArqueoCierreDrawerComponent, un componente separado renderizado vía LayoutDrawerFacadeService
  // (NgComponentOutlet, no es hijo de cuadratura-content) — sin un lugar compartido, el botón
  // "Cerrar Caja" del Hero (que se quedó en cuadratura-content) no podría leer si el arqueo
  // habilita el cierre. Mutable público, mismo patrón que fondoInicial/egresoTipoPreset arriba.
  readonly cantidades = signal<Record<string, number>>({
    bill20000: 0,
    bill10000: 0,
    bill5000: 0,
    bill2000: 0,
    bill1000: 0,
    coin500: 0,
    coin100: 0,
    coin50: 0,
    coin10: 0,
  });
  readonly notasArqueo = signal<string>('');
  readonly realizarArqueo = signal<boolean>(false);

  private readonly _pagosHoy = signal<IngresoRow[]>([]);
  private readonly _gastosHoy = signal<EgresoRow[]>([]);
  private readonly _cajaYaCerrada = signal<boolean>(false);
  private readonly _cierreHoy = signal<CashClosing | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);
  private readonly _isExporting = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  /**
   * La última carga del día falló (fix-044-i). Con datos incompletos o viejos en pantalla, el
   * cierre guardaría totales falsos (podía cerrarse en $0 habiendo cobrado): bloquea el cierre
   * hasta que una carga termine bien.
   */
  private readonly _cargaFallida = signal<boolean>(false);

  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;
  private _realtimeChannel: any | null = null;
  private _borradorTimer: ReturnType<typeof setTimeout> | null = null;

  // ── 2. ESTADO EXPUESTO (Público) ──────────────────────────────────────────
  readonly pagosHoy = this._pagosHoy.asReadonly();
  readonly gastosHoy = this._gastosHoy.asReadonly();
  readonly cajaYaCerrada = this._cajaYaCerrada.asReadonly();
  readonly cierreHoy = this._cierreHoy.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly isExporting = this._isExporting.asReadonly();
  readonly error = this._error.asReadonly();
  readonly cargaFallida = this._cargaFallida.asReadonly();

  /**
   * Quitar un pago de matrícula o un anticipo es solo del admin (fix-044-i): la RLS ya solo le
   * permite a él borrar `payments` e `instructor_advances`. La UI de la secretaria no muestra esos
   * botones; gastos, cursos singulares y servicios especiales siguen abiertos a ambos roles.
   */
  readonly puedeEliminarRestringidos = computed(() => this.auth.currentUser()?.role === 'admin');

  readonly ingresosEfectivoHoy = computed(() =>
    this._pagosHoy().reduce((sum, p) => sum + p.claseB, 0),
  );
  readonly otrosIngresosHoy = computed(() =>
    this._pagosHoy().reduce((sum, p) => sum + p.claseA + p.otros, 0),
  );
  readonly totalIngresosHoy = computed(() => this._pagosHoy().reduce((sum, p) => sum + p.total, 0));
  readonly totalEgresosHoy = computed(() => this._gastosHoy().reduce((sum, e) => sum + e.monto, 0));
  /** Solo egresos pagados en efectivo — es lo único que sale físicamente de la caja (fix-211-m). */
  readonly totalEgresosEfectivoHoy = computed(() =>
    this._gastosHoy().reduce((sum, e) => sum + (e.paymentMethod === 'efectivo' ? e.monto : 0), 0),
  );
  readonly saldoTeoricoEfectivo = computed(
    () => this.fondoInicial() + this.ingresosEfectivoHoy() - this.totalEgresosEfectivoHoy(),
  );

  // ── Computed del Arqueo Físico (spec 0004-i, movidos desde cuadratura-content) ──
  readonly totalArqueo = computed(() => {
    const c = this.cantidades();
    return (
      c['bill20000'] * 20_000 +
      c['bill10000'] * 10_000 +
      c['bill5000'] * 5_000 +
      c['bill2000'] * 2_000 +
      c['bill1000'] * 1_000 +
      c['coin500'] * 500 +
      c['coin100'] * 100 +
      c['coin50'] * 50 +
      c['coin10'] * 10
    );
  });

  readonly diferenciaArqueo = computed(() => this.totalArqueo() - this.saldoTeoricoEfectivo());

  readonly puedeCerrarCaja = computed(() => {
    if (this._cajaYaCerrada() || this._isSaving() || this._cargaFallida()) return false;
    if (!this.realizarArqueo()) return true;
    if (this.diferenciaArqueo() === 0) return true;
    return this.notasArqueo().trim().length > 0;
  });

  readonly colorDiferenciaArqueo = computed(() => {
    const d = this.diferenciaArqueo();
    if (d === 0) return 'var(--state-success)';
    if (d < 0) return 'var(--state-error)';
    return 'var(--state-warning)';
  });

  // ── 3. MÉTODOS DE ACCIÓN ─────────────────────────────────────────────────────

  setupRealtime(): void {
    if (this._realtimeChannel) return;
    this._realtimeChannel = this.supabase.client
      .channel('cuadratura-hoy-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'instructor_advances' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_closings' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'standalone_course_enrollments' },
        () => void this.refreshSilently(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'special_service_sales' },
        () => void this.refreshSilently(),
      )
      .subscribe();
  }

  destroyRealtime(): void {
    if (this._realtimeChannel) {
      void this.supabase.client.removeChannel(this._realtimeChannel);
      this._realtimeChannel = null;
    }
  }

  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }

  async initialize(): Promise<void> {
    this.setupRealtime();
    const branchId = this.getActiveBranchId();
    if (this._initialized && branchId === this._lastBranchId) {
      void this.refreshSilently();
      return;
    }

    this._isLoading.set(true);
    try {
      await this.cargarDia();
      this._initialized = true;
      this._lastBranchId = branchId;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Refresco SWR/Realtime sin skeleton. No lanza: los datos anteriores siguen visibles, pero si
   * falla queda marcada la carga fallida y el cierre bloqueado — pueden estar viejos (fix-044-i).
   */
  async refreshSilently(): Promise<void> {
    await this.cargarDia();
  }

  /** "Reintentar" del aviso de carga fallida (fix-044-i): vuelve a cargar el día con skeleton. */
  async reintentar(): Promise<void> {
    this._isLoading.set(true);
    try {
      await this.cargarDia();
    } finally {
      this._isLoading.set(false);
    }
  }

  /** Carga el día y deja `_error`/`_cargaFallida` según el resultado. Nunca lanza. */
  private async cargarDia(): Promise<void> {
    try {
      await this.fetchAll();
      this._error.set(null);
      this._cargaFallida.set(false);
    } catch {
      this._error.set('No se pudieron cargar los movimientos del día.');
      this._cargaFallida.set(true);
    }
  }

  /** Public alias for refresh used by components */
  async refresh(): Promise<void> {
    return this.refreshSilently();
  }

  private async fetchAll(): Promise<void> {
    const today = chileToday();
    const branchId = this.getActiveBranchId();
    await Promise.all([
      this.fetchPayments(today, branchId),
      this.fetchExpensesAndAdvances(today, branchId),
      this.checkCajaStatus(today, branchId),
    ]);
  }

  private async fetchPayments(today: string, branchId: number | null): Promise<void> {
    // Día de Chile como rango semiabierto de instantes: [start, endExclusive).
    const { start, endExclusive } = chileDayRange(today);

    let query: any = this.supabase.client
      .from('payments')
      .select('*, enrollments!inner(branch_id, number, license_group)')
      .in('status', ['paid', 'completado'])
      .eq('payment_date', today);

    if (branchId) {
      query = query.eq('enrollments.branch_id', branchId);
    }

    // El ordenamiento y limitación siempre al final de la cadena de filtros
    const [{ data, error }, singulares, serviciosEspeciales] = await Promise.all([
      query.order('payment_date', { ascending: true }),
      this.fetchSingularSales(start, endExclusive, branchId),
      this.fetchSpecialServiceSales(today, branchId),
    ]);
    // fix-044-i: una lectura fallida lanza (antes caía a `[]` y la Caja mostraba $0 sin aviso).
    if (error) throw error;
    this._pagosHoy.set([
      ...(data ?? []).map(mapPaymentToIngreso),
      ...singulares,
      ...serviciosEspeciales,
    ]);
  }

  /**
   * Ventas de Servicios Especiales cobradas hoy (fix-024-i). `special_service_sales` nunca se
   * sumaba a los ingresos de Caja Diaria — mismo patrón que `fetchSingularSales()`.
   */
  private async fetchSpecialServiceSales(
    today: string,
    branchId: number | null,
  ): Promise<IngresoRow[]> {
    let query: any = this.supabase.client
      .from('special_service_sales')
      .select('id, price, service_name, client_name, document_number')
      .eq('sale_date', today)
      .eq('paid', true);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((row: any) =>
      mapSpecialServiceSaleToIngreso({
        id: row.id,
        price: row.price,
        serviceName: row.service_name,
        clientName: row.client_name ?? '—',
        documentNumber: row.document_number ?? null,
      }),
    );
  }

  /**
   * Cobros de cursos singulares pagados hoy (RF-035 · fix-016 AC3).
   * Fuente: standalone_course_enrollments.paid_at — no existe fila en payments
   * para estas ventas, por eso se integran aquí como IngresoRow propios.
   */
  private async fetchSingularSales(
    start: string,
    end: string,
    branchId: number | null,
  ): Promise<IngresoRow[]> {
    let query: any = this.supabase.client
      .from('standalone_course_enrollments')
      .select(
        `
        id,
        amount_paid,
        payment_method,
        paid_at,
        standalone_courses!inner(name, branch_id),
        students!inner(users!inner(first_names, paternal_last_name))
      `,
      )
      .eq('payment_status', 'paid')
      .gte('paid_at', start)
      .lt('paid_at', end);

    if (branchId) {
      query = query.eq('standalone_courses.branch_id', branchId);
    }

    const { data, error } = await query.order('paid_at', { ascending: true });
    if (error) throw error;

    return (data ?? []).map((row: any) =>
      mapSingularSaleToIngreso({
        id: row.id,
        amount_paid: row.amount_paid,
        payment_method: row.payment_method,
        courseName: row.standalone_courses?.name ?? 'Curso singular',
        studentName:
          `${row.students?.users?.first_names ?? ''} ${row.students?.users?.paternal_last_name ?? ''}`.trim(),
      }),
    );
  }

  private async fetchExpensesAndAdvances(today: string, branchId: number | null): Promise<void> {
    let expQuery: any = this.supabase.client.from('expenses').select('*').eq('date', today);
    if (branchId) {
      expQuery = expQuery.eq('branch_id', branchId);
    }

    // `instructor_advances` no tiene `branch_id` propio — la sede sale del instructor
    // (`instructors.users.branch_id`), mismo patrón que `AnticiposFacade.fetchData()`.
    // Sin esto, una cuadratura de sede específica sumaba anticipos de TODAS las sedes (fix-243-m).
    let advQuery: any = this.supabase.client
      .from('instructor_advances')
      .select('*, instructors!inner(users!inner(branch_id))')
      .eq('date', today);
    if (branchId) {
      advQuery = advQuery.eq('instructors.users.branch_id', branchId);
    }

    const [expRes, advRes] = await Promise.all([expQuery, advQuery]);
    if (expRes.error) throw expRes.error;
    if (advRes.error) throw advRes.error;
    const gastos = (expRes.data ?? []).map(mapExpenseToEgreso);
    const anticipos = (advRes.data ?? []).map(mapAdvanceToEgreso);
    this._gastosHoy.set([...gastos, ...anticipos]);
  }

  /**
   * Trae la fila de `cash_closings` de hoy (si existe) sin filtrar por status — a diferencia
   * de antes (spec 0012-m), un borrador (`status='draft'`) también puede estar ahí. Solo una
   * fila `status='closed'` cuenta como caja cerrada; un borrador restaura el estado de arqueo
   * pero deja la caja operable (AC5).
   */
  private async checkCajaStatus(today: string, branchId: number | null): Promise<void> {
    let query: any = this.supabase.client.from('cash_closings').select('*').eq('date', today);
    if (branchId) query = query.eq('branch_id', branchId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;

    const cerrada = data?.status === 'closed';
    this._cajaYaCerrada.set(cerrada);
    this._cierreHoy.set(cerrada ? data : null);

    if (data?.status === 'draft') {
      this.fondoInicial.set(data.opening_amount ?? 0);
      this.realizarArqueo.set(data.arqueo_enabled ?? false);
      this.notasArqueo.set(data.notes ?? '');
      this.cantidades.set({
        bill20000: data.qty_bill_20000 ?? 0,
        bill10000: data.qty_bill_10000 ?? 0,
        bill5000: data.qty_bill_5000 ?? 0,
        bill2000: data.qty_bill_2000 ?? 0,
        bill1000: data.qty_bill_1000 ?? 0,
        coin500: data.qty_coin_500 ?? 0,
        coin100: data.qty_coin_100 ?? 0,
        coin50: data.qty_coin_50 ?? 0,
        coin10: data.qty_coin_10 ?? 0,
      });
    }
  }

  /**
   * Quita un ingreso del día. Toda escritura pasa por `assertWriteOk` con `requireRows`: un
   * UPDATE/DELETE que la RLS filtra no devuelve error, devuelve 0 filas (fix-044-i). Si el día ya
   * tiene caja cerrada, un trigger rechaza la escritura con `CAJA_CERRADA`.
   */
  async eliminarIngreso(row: IngresoRow): Promise<boolean> {
    if (row.source === 'payment' && !this.puedeEliminarRestringidos()) {
      this.toast.error('Solo un administrador puede quitar un pago de matrícula.');
      return false;
    }

    this._isSaving.set(true);
    try {
      if (row.source === 'singular') {
        // Cobro de curso singular: no se borra la inscripción, se revierte
        // el pago a pendiente (la inscripción sigue vigente).
        await this.revertirCobro('standalone_course_enrollments', row.id, {
          payment_status: 'pending',
          amount_paid: 0,
          paid_at: null,
        });
        this.toast.success('Cobro revertido: la inscripción quedó pendiente de pago.');
      } else if (row.source === 'special_service') {
        // fix-024-i: venta de Servicio Especial — no se borra, se revierte el cobro
        // (misma filosofía que 'singular': la venta sigue existiendo, solo deja de
        // contar como ingreso cobrado hoy).
        await this.revertirCobro('special_service_sales', row.id, {
          paid: false,
          status: 'pending',
        });
        this.toast.success('Cobro revertido: la venta quedó pendiente de pago.');
      } else {
        // Pago de matrícula: un solo DELETE. El saldo del alumno lo recalcula el trigger
        // `trg_update_balance` en la misma transacción — antes el cliente restaba el saldo y
        // después borraba, y si el borrado fallaba el saldo quedaba inflado (fix-044-i).
        assertWriteOk(
          await this.supabase.client.from('payments').delete().eq('id', row.id).select('id'),
          { requireRows: true },
        );
        this.toast.success('Pago eliminado. El saldo del alumno se recalculó.');
      }
      void this.refreshSilently();
      return true;
    } catch (err) {
      this.toast.error(toFriendlyDbMessage(err, 'No se pudo eliminar el ingreso.'));
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  /** Revierte un cobro a pendiente; lanza si falla o si la RLS no dejó tocar la fila. */
  private async revertirCobro(
    tabla: 'standalone_course_enrollments' | 'special_service_sales',
    id: number,
    cambios: Record<string, unknown>,
  ): Promise<void> {
    assertWriteOk(
      await this.supabase.client.from(tabla).update(cambios).eq('id', id).select('id'),
      { requireRows: true },
    );
  }

  async eliminarEgreso(row: EgresoRow): Promise<boolean> {
    if (row.tipo === 'advance' && !this.puedeEliminarRestringidos()) {
      this.toast.error('Solo un administrador puede quitar un anticipo.');
      return false;
    }

    this._isSaving.set(true);
    try {
      const tabla = row.tipo === 'expense' ? 'expenses' : 'instructor_advances';
      assertWriteOk(await this.supabase.client.from(tabla).delete().eq('id', row.id).select('id'), {
        requireRows: true,
      });
      this.toast.success('Egreso eliminado correctamente.');
      void this.refreshSilently();
      return true;
    } catch (err) {
      this.toast.error(toFriendlyDbMessage(err, 'No se pudo eliminar el egreso.'));
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Registra un egreso de tipo `gasto` o `combustible` en `expenses`.
   *
   * El tipo `anticipo` NO se maneja acá — el componente lo enruta a
   * `AnticiposFacade.registrarAnticipo()` (necesita `instructor_id`, y `instructor_advances`
   * no tiene columna `branch_id`). Ver fix-243-m.
   *
   * `datos.branchId` es obligatorio y NUNCA puede ser `null`: para `gasto` lo elige el usuario,
   * para `combustible` sale de la sede del vehículo (o se elige si es un vehículo legacy sin
   * sede). Sin esto un egreso registrado con el admin en "Todas las sedes" quedaba huérfano
   * (`branch_id: null`), invisible en toda cuadratura por sede — DG-082.
   */
  async registrarEgreso(datos: EgresoFormData): Promise<boolean> {
    const user = this.auth.currentUser();
    if (!user) return false;

    if (datos.tipo === 'anticipo') {
      this.toast.error('Los anticipos se registran por el flujo de instructor.');
      return false;
    }
    if (datos.tipo === 'combustible' && !datos.vehiculoId) {
      this.toast.error('Selecciona el vehículo del egreso de combustible.');
      return false;
    }
    if (datos.branchId == null) {
      this.toast.error('Selecciona la sede del egreso.');
      return false;
    }

    this._isSaving.set(true);
    try {
      const today = chileToday();
      const { error } = await this.supabase.client.from('expenses').insert({
        date: today,
        amount: datos.monto,
        description: datos.descripcion,
        category: datos.tipo === 'combustible' ? 'combustible' : null,
        vehicle_id: datos.vehiculoId ?? null,
        branch_id: datos.branchId,
        registered_by: user.dbId,
        payment_method: datos.metodoPago,
      });
      if (error) throw error;
      this.toast.success('Egreso registrado correctamente.');
      void this.refreshSilently();
      return true;
    } catch {
      this.toast.error('Error al registrar el egreso.');
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  async exportar(format: 'excel' | 'pdf'): Promise<void> {
    this._isExporting.set(true);
    try {
      const today = chileToday();
      const branchId = this.getActiveBranchId();
      const { data, error } = await this.supabase.client.functions.invoke(
        'generate-cash-closing-report',
        { body: { format, date: today, branch_id: branchId } },
      );
      if (error) throw error;

      const fecha = today.replace(/-/g, '');
      if (format === 'excel') {
        const { sheetName, rows, filename } = data as {
          sheetName: string;
          rows: (string | number)[][];
          filename: string;
        };
        downloadExcel(sheetName, [], rows, filename ?? `Cuadratura_${fecha}`);
      } else {
        const rawBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
        const blob = new Blob([rawBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Cuadratura_${fecha}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
      this.toast.success('Reporte generado correctamente.');
    } catch {
      this.toast.error('No se pudo generar el reporte. Inténtalo de nuevo.');
    } finally {
      this._isExporting.set(false);
    }
  }

  /**
   * Arma el CierrePayload a partir del estado de arqueo propio del Facade (spec 0004-i —
   * antes lo armaba cuadratura-content.component.ts en onGuardarCierre(), ahora que el
   * conteo vive en ArqueoCierreDrawerComponent el Facade es el único lugar que tiene
   * todas las piezas juntas).
   */
  private buildCierrePayload(): CierrePayload {
    const c = this.cantidades();
    const conArqueo = this.realizarArqueo();
    return {
      bill20000: conArqueo ? c['bill20000'] : 0,
      bill10000: conArqueo ? c['bill10000'] : 0,
      bill5000: conArqueo ? c['bill5000'] : 0,
      bill2000: conArqueo ? c['bill2000'] : 0,
      bill1000: conArqueo ? c['bill1000'] : 0,
      coin500: conArqueo ? c['coin500'] : 0,
      coin100: conArqueo ? c['coin100'] : 0,
      coin50: conArqueo ? c['coin50'] : 0,
      coin10: conArqueo ? c['coin10'] : 0,
      notes: this.notasArqueo(),
      arqueoTotal: conArqueo ? this.totalArqueo() : this.saldoTeoricoEfectivo(),
    };
  }

  /** Fila completa de `cash_closings` para el cierre definitivo del día (status `closed`). */
  private buildCierreRow(closedBy: number | undefined): Record<string, unknown> {
    const pagos = this._pagosHoy();
    const payload = this.buildCierrePayload();
    return {
      date: chileToday(),
      branch_id: this.getActiveBranchId(),
      closed_by: closedBy,
      closed_at: new Date().toISOString(),
      status: 'closed',
      closed: true,
      opening_amount: this.fondoInicial(),
      arqueo_enabled: this.realizarArqueo(),
      cash_amount: pagos.reduce((s, p) => s + p.claseB, 0),
      transfer_amount: pagos.reduce((s, p) => s + p.claseA, 0),
      card_amount: pagos.reduce((s, p) => s + p.otros, 0),
      voucher_amount: pagos.reduce((s, p) => s + p.sence, 0),
      total_income: this.totalIngresosHoy(),
      total_expenses: this.totalEgresosHoy(),
      // Snapshot del egreso pagado en efectivo — lo único que baja el saldo físico
      // (fix-211-m). El historial lo usa para separar egreso-efectivo de egreso-tarjeta
      // sin depender de una identidad algebraica sobre `balance` (fix-226-m).
      cash_expenses: this.totalEgresosEfectivoHoy(),
      balance: this.saldoTeoricoEfectivo(),
      payments_count: pagos.length,
      arqueo_amount: payload.arqueoTotal,
      difference: payload.arqueoTotal - this.saldoTeoricoEfectivo(),
      qty_bill_20000: payload.bill20000,
      qty_bill_10000: payload.bill10000,
      qty_bill_5000: payload.bill5000,
      qty_bill_2000: payload.bill2000,
      qty_bill_1000: payload.bill1000,
      qty_coin_500: payload.coin500,
      qty_coin_100: payload.coin100,
      qty_coin_50: payload.coin50,
      qty_coin_10: payload.coin10,
      notes: payload.notes || null,
    };
  }

  /**
   * Arma el payload de borrador a partir del estado crudo de los signals de arqueo — a
   * diferencia de `buildCierrePayload()`, NO zerea las cantidades cuando `realizarArqueo` está
   * apagado: el borrador debe restaurar exactamente lo que la secretaria dejó tipeado, aunque
   * haya apagado el toggle a mitad de camino (spec 0012-m, AC2).
   */
  private buildBorradorPayload(): Record<string, unknown> {
    const c = this.cantidades();
    return {
      date: chileToday(),
      branch_id: this.getActiveBranchId(),
      status: 'draft',
      closed: false,
      opening_amount: this.fondoInicial(),
      arqueo_enabled: this.realizarArqueo(),
      qty_bill_20000: c['bill20000'],
      qty_bill_10000: c['bill10000'],
      qty_bill_5000: c['bill5000'],
      qty_bill_2000: c['bill2000'],
      qty_bill_1000: c['bill1000'],
      qty_coin_500: c['coin500'],
      qty_coin_100: c['coin100'],
      qty_coin_50: c['coin50'],
      qty_coin_10: c['coin10'],
      notes: this.notasArqueo() || null,
    };
  }

  /**
   * Autoguardado del borrador de arqueo (spec 0012-m). Debounced: se llama en cada
   * `(input)`/`(click)` del drawer de Arqueo y Cierre, pero solo escribe tras ~800ms sin
   * actividad. Falla silenciosa (mismo criterio que `refreshSilently()` del patrón SWR) — un
   * error de red no debe interrumpir a la secretaria a mitad del conteo.
   */
  guardarBorrador(): void {
    if (this._cajaYaCerrada()) return;
    if (this._borradorTimer) clearTimeout(this._borradorTimer);
    this._borradorTimer = setTimeout(() => void this.persistirBorrador(), 800);
  }

  private async persistirBorrador(): Promise<void> {
    if (!this.auth.currentUser()) return;
    const { error } = await this.supabase.client
      .from('cash_closings')
      .upsert(this.buildBorradorPayload(), { onConflict: 'date,branch_id_key' });
    // Sin aviso — el próximo cambio reintenta (mismo criterio que refreshSilently()). Pero si
    // falló porque otra pestaña ya cerró la caja (CIERRE_DEFINITIVO), recargar hace que esta
    // pestaña se entere y deje de ofrecer el cierre (fix-044-i).
    if (error) void this.refreshSilently();
  }

  /** Limpia el estado de arqueo tras cerrar caja exitosamente — no debe arrastrarse al día siguiente. */
  private resetArqueoState(): void {
    this.cantidades.set({
      bill20000: 0,
      bill10000: 0,
      bill5000: 0,
      bill2000: 0,
      bill1000: 0,
      coin500: 0,
      coin100: 0,
      coin50: 0,
      coin10: 0,
    });
    this.notasArqueo.set('');
    this.realizarArqueo.set(false);
  }

  async cerrarCaja(): Promise<boolean> {
    const user = this.auth.currentUser();
    if (!user) return false;
    // Con la carga del día fallida, los totales en pantalla pueden ser $0 o viejos: el cierre los
    // guardaría tal cual (fix-044-i). El botón ya está deshabilitado; esto es la red de seguridad.
    if (this._cargaFallida()) {
      this.toast.error(
        'No se puede cerrar la caja: los movimientos del día no cargaron. Reintenta.',
      );
      return false;
    }
    this._isSaving.set(true);
    try {
      if (this._borradorTimer) {
        clearTimeout(this._borradorTimer);
        this._borradorTimer = null;
      }
      // upsert (no insert plano, spec 0012-m): si ya existía un borrador para hoy/sede, se
      // actualiza la MISMA fila (mismo id) en vez de crear una duplicada. Sobre un cierre ya
      // `closed` la BD lo rechaza (trigger CIERRE_DEFINITIVO, o la RLS para la secretaria).
      assertWriteOk(
        await this.supabase.client
          .from('cash_closings')
          .upsert(this.buildCierreRow(user.dbId), { onConflict: 'date,branch_id_key' }),
      );
      this.toast.success('Caja cerrada correctamente.');
      this.resetArqueoState();
      void this.refreshSilently();
      return true;
    } catch (err) {
      // No se toca el arqueo: si no se guardó, lo contado tiene que seguir ahí para reintentar.
      // Se recarga para saber si el rechazo fue porque otra pestaña/persona ya cerró la caja.
      await this.refreshSilently();
      const cierre = this._cierreHoy();
      this.toast.error(
        cierre?.closed_at
          ? `Esta caja ya se cerró a las ${formatChileTime(cierre.closed_at)} (en otra pestaña o por otra persona). La pantalla se actualizó con ese cierre.`
          : toFriendlyDbMessage(err, 'No se pudo cerrar la caja. Inténtalo de nuevo.'),
      );
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }
}
