import { puedeAvanzarMes } from '@core/utils/month-nav.utils';
import { chileParts, chileYear, monthDays } from '@core/utils/chile-time.utils';
import { computed, inject, Injectable, signal, untracked } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { downloadExcel } from '@core/utils/excel.utils';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import { assertReadOk, assertWriteOk } from '@core/utils/db-error.utils';
import { createRequestGuard } from '@core/utils/request-guard.utils';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { getLiquidacionAvatarColor } from '@core/utils/liquidaciones-avatar-colors';
import { PayrollConfigFacade } from '@core/facades/payroll-config.facade';
import type {
  LiquidacionRow,
  LiquidacionesKpis,
  PagoInstructorPayload,
} from '@core/models/ui/liquidaciones.model';

// ─── Helpers puros ────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ─── Facade ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LiquidacionesFacade {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly notifications = inject(NotificationsFacade);
  private readonly payrollConfig = inject(PayrollConfigFacade);
  private readonly toast = inject(ToastService);

  // ── Estado privado ────────────────────────────────────────────────────────
  private readonly _liquidaciones = signal<LiquidacionRow[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);
  private readonly _isExporting = signal<boolean>(false);
  /** Caso A: la consulta vigente no cargó y no hay datos que la respondan. */
  private readonly _error = signal<string | null>(null);
  /** Caso B: falló un refresco de la misma consulta; lo visible se queda. */
  private readonly _refreshFailed = signal<boolean>(false);
  private readonly _reintentando = signal<boolean>(false);

  // ── SWR State ────────────────────────────────────────────────────────────
  private _initialized = false;
  /**
   * Consulta (mes, año y sede) que responden las filas visibles; null si no hay ninguna vigente.
   * Separa los dos casos de falla: si falla esta misma es un refresco (B), si falla otra es A.
   */
  private readonly _datosDe = signal<string | null>(null);
  /** Guard anti respuestas fuera de orden (regla facades §7). */
  private readonly cargaGuard = createRequestGuard();

  // ── Navegación de mes ─────────────────────────────────────────────────────
  private readonly _mesActual = signal<number>(chileParts().month);
  private readonly _anioActual = signal<number>(chileYear());

  // ── Realtime ─────────────────────────────────────────────────────────────
  private _realtimeChannel: any | null = null;

  // ── Estado público ────────────────────────────────────────────────────────
  readonly liquidaciones = this._liquidaciones.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly isExporting = this._isExporting.asReadonly();
  readonly error = this._error.asReadonly();
  /** Un refresco falló: las filas visibles pueden no estar actualizadas. */
  readonly refreshFailed = this._refreshFailed.asReadonly();
  readonly reintentando = this._reintentando.asReadonly();
  readonly mesActual = this._mesActual.asReadonly();
  readonly anioActual = this._anioActual.asReadonly();
  readonly selectedRow = signal<LiquidacionRow | null>(null);

  // ── Computed KPIs ─────────────────────────────────────────────────────────
  /** null sin una carga vigente: nunca se muestra un $0 que no salió de los datos. */
  readonly kpis = computed<LiquidacionesKpis | null>(() => {
    if (this._datosDe() === null) return null;
    const rows = this._liquidaciones();
    return {
      totalNomina: rows.reduce((s, r) => s + r.totalBaseAmount, 0),
      totalAnticipos: rows.reduce((s, r) => s + r.totalAdvances, 0),
      totalPagados: rows.filter((r) => r.status === 'paid').length,
      totalInstructores: rows.length,
    };
  });

  /**
   * El pago guarda montos calculados con estas lecturas (base, anticipos y líquido) y marca los
   * anticipos del mes como descontados: solo se permite si la última carga de la consulta vigente
   * terminó bien. Deshacer no depende de esto: borra por instructor y período, sin usar montos.
   */
  readonly puedeRegistrarPago = computed(
    () =>
      !this._isLoading() &&
      !this._refreshFailed() &&
      this._error() === null &&
      this._datosDe() !== null &&
      this._datosDe() === this.contextoActual().key,
  );

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

  /** La flecha "Mes siguiente" solo avanza hasta el mes actual de Chile (fix-079-i, F04). */
  readonly puedeAvanzarMes = computed(() => puedeAvanzarMes(this._anioActual(), this._mesActual()));

  mesSiguiente(): void {
    if (!puedeAvanzarMes(this._anioActual(), this._mesActual())) return;
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
      .on(
        'postgres_changes',
        // spec 0014-m: cambiar la tarifa por hora de una sede recalcula la nómina.
        { event: '*', schema: 'public', table: 'branch_payroll_config' },
        () => {
          console.log('[LiquidacionesFacade] Realtime update: Payroll config changed');
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

  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }

  private contextoActual() {
    const mes = this._mesActual();
    const anio = this._anioActual();
    const branchId = this.getActiveBranchId();
    return { mes, anio, branchId, key: `${anio}-${mes}|${branchId}` };
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  /**
   * SWR: con datos vigentes de la misma consulta refresca en silencio; si no, carga con skeleton.
   * Sin seguimiento: corre dentro del effect de la pantalla, que solo debe depender de la sede.
   */
  async initialize(): Promise<void> {
    return untracked(() => {
      // Aseguramos suscripción realtime una sola vez
      this.setupRealtime();

      if (this._initialized && this._datosDe() === this.contextoActual().key) {
        void this.refreshSilently();
        return Promise.resolve();
      }
      return this.cargar();
    });
  }

  /** Botón "Reintentar": caso B sin skeleton, caso A con carga completa. */
  async reintentar(): Promise<void> {
    this._reintentando.set(true);
    try {
      await this.cargar();
    } finally {
      this._reintentando.set(false);
    }
  }

  /** Re-entrada SWR, Realtime y después de guardar. Si falla, queda en `refreshFailed`. */
  private async refreshSilently(): Promise<void> {
    await this.cargar();
  }

  /** Legacy wrapper */
  async cargarLiquidaciones(): Promise<void> {
    return this.initialize();
  }

  /**
   * Única puerta de carga; nunca rechaza. Si lo visible responde a esta misma consulta se mantiene
   * mientras tanto y una falla es caso B. Si no, se retira de inmediato y una falla es caso A.
   */
  private async cargar(): Promise<void> {
    const contexto = this.contextoActual();
    const token = this.cargaGuard.next();
    const mismaConsulta = this._initialized && this._datosDe() === contexto.key;

    if (!mismaConsulta) {
      this.retirarDatos();
      this._error.set(null);
      this._refreshFailed.set(false);
      this._isLoading.set(true);
    }

    try {
      const rows = await this.fetchLiquidacionesData(
        contexto.mes,
        contexto.anio,
        contexto.branchId,
      );
      if (!this.cargaGuard.isCurrent(token)) return;

      this._liquidaciones.set(rows);
      this._datosDe.set(contexto.key);
      this._initialized = true;
      this._error.set(null);
      this._refreshFailed.set(false);
      this.sincronizarSeleccion(rows);
    } catch {
      if (!this.cargaGuard.isCurrent(token)) return;

      if (mismaConsulta) {
        this._refreshFailed.set(true);
      } else {
        this._error.set('No se pudieron cargar las liquidaciones.');
      }
    } finally {
      // Una carga reemplazada no apaga el skeleton de la que sigue en curso.
      if (this.cargaGuard.isCurrent(token)) this._isLoading.set(false);
    }
  }

  private retirarDatos(): void {
    this._liquidaciones.set([]);
    this._datosDe.set(null);
    this._initialized = false;
    this.selectedRow.set(null);
  }

  /** El drawer de pago abierto debe mostrar y pagar los montos de la carga vigente. */
  private sincronizarSeleccion(rows: LiquidacionRow[]): void {
    const seleccionada = this.selectedRow();
    if (!seleccionada) return;
    this.selectedRow.set(rows.find((r) => r.instructorId === seleccionada.instructorId) ?? null);
  }

  /** Lanza si falla cualquiera de las lecturas: todas forman los mismos montos. */
  private async fetchLiquidacionesData(
    mes: number,
    anio: number,
    branchId: number | null,
  ): Promise<LiquidacionRow[]> {
    const mm = String(mes).padStart(2, '0');
    const lastDay = monthDays(anio, mes);
    const fechaInicio = `${anio}-${mm}-01`;
    const fechaFin = `${anio}-${mm}-${String(lastDay).padStart(2, '0')}`;

    const [instrRes, hoursRes, advancesRes, paymentsRes, rateForBranch] = await Promise.all([
      this.supabase.client
        .from('instructors')
        .select('id, user_id, users(id, first_names, paternal_last_name, rut, branch_id)'),
      this.supabase.client
        .from('instructor_monthly_hours')
        .select('instructor_id, practical_sessions, total_equivalent')
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
      // spec 0014-m: tarifa por hora por sede (global por sede, no por instructor).
      // Lanza si no se pudo leer: el valor de respaldo es solo para una sede sin fila.
      this.payrollConfig.readRates(),
    ]);

    const instructors = assertReadOk(instrRes);
    const hours = assertReadOk(hoursRes);
    const advances = assertReadOk(advancesRes);
    const payments = assertReadOk(paymentsRes);

    const hoursMap = new Map<number, number>(
      hours.map((h) => [h.instructor_id, h.total_equivalent ?? 0]),
    );

    const sessionsMap = new Map<number, number>(
      hours.map((h) => [h.instructor_id, h.practical_sessions ?? 0]),
    );

    const advancesMap = new Map<number, number>();
    for (const adv of advances) {
      advancesMap.set(adv.instructor_id, (advancesMap.get(adv.instructor_id) ?? 0) + adv.amount);
    }

    const paymentsMap = new Map<number, any>(payments.map((p) => [p.instructor_id, p]));

    return instructors
      .filter((instr) => {
        const u = instr.users as any;
        const bId = Array.isArray(u) ? u[0]?.branch_id : u?.branch_id;
        if (branchId && bId !== branchId) return false;

        const totalHours = hoursMap.get(instr.id) ?? 0;
        const totalAdvances = advancesMap.get(instr.id) ?? 0;
        const payment = paymentsMap.get(instr.id);

        return totalHours > 0 || totalAdvances > 0 || !!payment;
      })
      .map((instr): LiquidacionRow => {
        const rawU = instr.users as any;
        const u = Array.isArray(rawU) ? rawU[0] : rawU;
        const nombre = `${u?.first_names ?? ''} ${u?.paternal_last_name ?? ''}`.trim() || '—';
        const totalHours = Math.round((hoursMap.get(instr.id) ?? 0) * 10) / 10;
        const practicalSessions = sessionsMap.get(instr.id) ?? 0;
        const totalAdvances = advancesMap.get(instr.id) ?? 0;
        const payment = paymentsMap.get(instr.id);
        // spec 0014-m: tarifa resuelta por la sede del instructor (no un valor único).
        // "Todas las escuelas" sigue calculando bien cada fila con la tarifa de su sede.
        const amountPerHour = rateForBranch(u?.branch_id ?? null);
        const totalBaseAmount = Math.round(totalHours * amountPerHour);
        const finalPaymentAmount = Math.max(0, totalBaseAmount - totalAdvances);

        return {
          instructorId: instr.id,
          userId: u?.id ?? 0,
          nombre,
          rut: u?.rut ?? '—',
          initials: getInitials(nombre),
          avatarColor: getLiquidacionAvatarColor(nombre),
          practicalSessions,
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
  }

  // ── Mutaciones ────────────────────────────────────────────────────────────
  // Un error de escritura se informa por toast: `error` y `refreshFailed` son solo de la carga.

  /**
   * Solo una fila de la carga vigente: una foto anterior puede traer otros montos, otro período u
   * otra sede. Las filas pagadas no se vuelven a registrar porque el upsert pisaría ese pago.
   */
  private puedePagarFila(row: LiquidacionRow): boolean {
    return (
      this.puedeRegistrarPago() && row.status === 'pending' && this._liquidaciones().includes(row)
    );
  }

  async registrarPago(row: LiquidacionRow, payload: PagoInstructorPayload): Promise<boolean> {
    const user = this.auth.currentUser();
    if (!user) {
      this.toast.error('No hay sesión activa.');
      return false;
    }
    if (!this.puedePagarFila(row)) {
      this.toast.warning('No se puede registrar el pago: actualiza las liquidaciones primero.');
      return false;
    }

    this._isSaving.set(true);

    try {
      const mes = this._mesActual();
      const anio = this._anioActual();
      const mm = String(mes).padStart(2, '0');
      const lastDay = monthDays(anio, mes);

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

      // fix-362-m: si esto falla en silencio los anticipos quedan "pendientes" y se descuentan
      // otra vez el mes siguiente. Lanzar es seguro: el pago de arriba es un upsert, reintentar
      // no duplica.
      assertWriteOk(
        await this.supabase.client
          .from('instructor_advances')
          .update({ status: 'discounted' })
          .eq('instructor_id', row.instructorId)
          .gte('date', `${anio}-${mm}-01`)
          .lte('date', `${anio}-${mm}-${String(lastDay).padStart(2, '0')}`),
      );

      this.notifyLiquidacionPagada(row, mes, anio);

      this.toast.success(`Liquidación de ${row.nombre} registrada correctamente.`);
      // El pago ya quedó guardado: si la relectura falla es éxito, con el aviso del caso B.
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? this.sanitizer.sanitize(err).message : 'Error al registrar el pago.';
      this.toast.error(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  async exportar(format: 'excel' | 'pdf'): Promise<void> {
    this._isExporting.set(true);
    try {
      const mes = this._mesActual();
      const anio = this._anioActual();
      const branchId = this.getActiveBranchId();
      const { data, error } = await this.supabase.client.functions.invoke(
        'generate-payroll-report',
        { body: { format, month: mes, year: anio, branch_id: branchId } },
      );
      if (error) throw error;

      const mm = String(mes).padStart(2, '0');
      const periodo = `${anio}${mm}`;
      if (format === 'excel') {
        const { sheetName, rows, filename } = data as {
          sheetName: string;
          rows: (string | number)[][];
          filename: string;
        };
        downloadExcel(sheetName, [], rows, filename ?? `Nomina_${periodo}`);
      } else {
        const rawBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
        const blob = new Blob([rawBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Nomina_${periodo}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
      this.toast.success('Reporte de nómina generado correctamente.');
    } catch {
      this.toast.error('No se pudo generar el reporte. Inténtalo de nuevo.');
    } finally {
      this._isExporting.set(false);
    }
  }

  /**
   * Sigue disponible con un refresco fallido: no guarda ningún monto calculado. Exige una fila de
   * la lista vigente porque el período que borra es el del mes en pantalla.
   */
  async deshacerPago(row: LiquidacionRow): Promise<boolean> {
    if (!row.paymentId || !this._liquidaciones().includes(row)) return false;

    this._isSaving.set(true);

    try {
      const mes = this._mesActual();
      const anio = this._anioActual();
      const mm = String(mes).padStart(2, '0');
      const lastDay = monthDays(anio, mes);

      const { error: delErr } = await this.supabase.client
        .from('instructor_monthly_payments')
        .delete()
        .eq('instructor_id', row.instructorId)
        .eq('period', `${anio}-${mm}`);

      if (delErr) throw delErr;

      // fix-362-m: sin revisar, un fallo dejaba los anticipos "descontados" de un pago que ya no
      // existe. Reintentar es seguro (el delete de arriba es idempotente).
      assertWriteOk(
        await this.supabase.client
          .from('instructor_advances')
          .update({ status: 'pending' })
          .eq('instructor_id', row.instructorId)
          .gte('date', `${anio}-${mm}-01`)
          .lte('date', `${anio}-${mm}-${String(lastDay).padStart(2, '0')}`),
      );

      this.toast.success(`Pago de ${row.nombre} revertido.`);
      await this.refreshSilently();
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? this.sanitizer.sanitize(err).message : 'Error al revertir el pago.';
      this.toast.error(msg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Notifica al instructor que su liquidación fue pagada (spec 0025, AC5).
   * `row.userId` ya viene resuelto desde `fetchLiquidacionesData()` — sin query extra.
   * Recibe el período pagado: el mes en pantalla pudo cambiar mientras se guardaba.
   * Fire-and-forget: un fallo nunca revierte el pago ya registrado.
   */
  private notifyLiquidacionPagada(row: LiquidacionRow, mes: number, anio: number): void {
    if (!row.userId) return;

    const periodo = `${mes}/${anio}`;

    this.notifications
      .notifyUsers([row.userId], {
        subject: 'Liquidación pagada',
        message: `Tu liquidación de ${periodo} fue pagada (líquido $${row.finalPaymentAmount}).`,
        referenceType: 'payment',
      })
      .catch(() => this.toast.warning('No se pudo notificar al instructor'));
  }
}
