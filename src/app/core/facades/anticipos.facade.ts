import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { resolveBranchScope } from '@core/utils/branch-scope.utils';
import { assertReadOk, toFriendlyDbMessage } from '@core/utils/db-error.utils';
import { createRequestGuard } from '@core/utils/request-guard.utils';
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
  const normalizado = tipo.trim().toLowerCase();
  return TIPO_LABELS[normalizado] ?? tipo;
}

export function mapStatus(raw: string | null): AdvanceStatus {
  if (raw === 'discounted' || raw === 'deducted') return 'discounted';
  return 'pending';
}

const ERROR_CARGA = 'No se pudieron cargar los anticipos.';

// ─── Facade ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AnticiposFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly notifications = inject(NotificationsFacade);
  private readonly toast = inject(ToastService);

  // ── Estado privado ────────────────────────────────────────────────────────
  private readonly _historial = signal<AnticipoHistorial[]>([]);
  private readonly _cuentaCorriente = signal<AnticipoCuentaCorriente[]>([]);
  private readonly _instructores = signal<InstructorOption[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);
  /** Caso A: la carga de la sede vigente falló y no hay datos que mostrar. Solo lecturas. */
  private readonly _error = signal<string | null>(null);
  /** Caso B: lo visible es de la sede vigente, pero el último refresco falló. */
  private readonly _refreshFailed = signal<boolean>(false);
  private readonly _selectedInstructorId = signal<number | null>(null);
  private _initialized = false;
  private _lastBranchId: number | null | undefined = undefined;
  /** Un solo guard: carga completa y refresco compiten por los mismos signals. */
  private readonly cargaGuard = createRequestGuard();

  // ── Estado público ────────────────────────────────────────────────────────
  readonly historial = this._historial.asReadonly();
  readonly cuentaCorriente = this._cuentaCorriente.asReadonly();
  readonly instructores = this._instructores.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly refreshFailed = this._refreshFailed.asReadonly();
  /** Instructor preseleccionado al abrir el drawer "Registrar Anticipo" desde una fila. */
  readonly selectedInstructorId = this._selectedInstructorId.asReadonly();

  /** Precarga el instructor del drawer "Registrar Anticipo"; `null` = sin preselección. */
  selectInstructor(id: number | null): void {
    this._selectedInstructorId.set(id);
  }

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

  /**
   * Sede activa para el scope de queries (fix-071): admin respeta el selector
   * del topbar; secretaria queda anclada a su sede (misconfig → ninguna fila).
   */
  private getActiveBranchId(): number | null {
    const user = this.auth.currentUser();
    return resolveBranchScope(
      user?.role,
      user?.branchId,
      this.branchFacade.selectedBranchId(),
      user?.canAccessBothBranches,
    );
  }

  // ── SWR Initialization ────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    const branchId = this.getActiveBranchId();
    if (this.tieneDatosDe(branchId)) {
      void this.refreshSilently();
      return;
    }
    await this.cargarCompleta(branchId);
  }

  /**
   * Botón "Reintentar" (spec 0060-b): con datos vigentes de la sede es un refresco sin skeleton
   * (caso B); si no, una carga completa (caso A).
   */
  async reintentar(): Promise<void> {
    const branchId = this.getActiveBranchId();
    if (this.tieneDatosDe(branchId)) {
      await this.refreshSilently();
      return;
    }
    await this.cargarCompleta(branchId);
  }

  private tieneDatosDe(branchId: number | null): boolean {
    return this._initialized && branchId === this._lastBranchId;
  }

  /**
   * Carga con skeleton: primera visita, cambio de sede o reintento del caso A. Retira lo anterior
   * al empezar: no responde a esta consulta, y los drawers no deben ofrecer instructores de otra
   * sede mientras carga. Solo una carga exitosa deja registrada la sede.
   */
  private async cargarCompleta(branchId: number | null): Promise<void> {
    const token = this.cargaGuard.next();
    this._initialized = false;
    this._lastBranchId = undefined;
    this.retirarDatos();
    this._isLoading.set(true);
    this._error.set(null);
    this._refreshFailed.set(false);
    try {
      if (!(await this.fetchData(token, branchId))) return;
      this.marcarCargada(branchId);
    } catch {
      if (this.cargaGuard.isCurrent(token)) this._error.set(ERROR_CARGA);
    } finally {
      if (this.cargaGuard.isCurrent(token)) this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    const token = this.cargaGuard.next();
    const branchId = this.getActiveBranchId();
    try {
      if (!(await this.fetchData(token, branchId))) return;
      this.marcarCargada(branchId);
    } catch {
      if (!this.cargaGuard.isCurrent(token)) return;
      if (this.tieneDatosDe(branchId)) {
        // Caso B: lo visible responde a la misma consulta; se queda, con el aviso.
        this._refreshFailed.set(true);
      } else {
        // Sin datos vigentes de esta sede: sigue siendo caso A, nunca "no hay instructores".
        this._initialized = false;
        this._lastBranchId = undefined;
        this.retirarDatos();
        this._refreshFailed.set(false);
        this._error.set(ERROR_CARGA);
      }
    } finally {
      // Si este refresco reemplazó a una carga completa, el skeleton termina con él.
      if (this.cargaGuard.isCurrent(token)) this._isLoading.set(false);
    }
  }

  private marcarCargada(branchId: number | null): void {
    this._initialized = true;
    this._lastBranchId = branchId;
    this._error.set(null);
    this._refreshFailed.set(false);
  }

  private retirarDatos(): void {
    this._historial.set([]);
    this._cuentaCorriente.set([]);
    this._instructores.set([]);
  }

  // ── Fetch de datos ────────────────────────────────────────────────────────

  /**
   * Anticipos e instructores forman una sola carga: si una lectura falla no se aplica nada, porque
   * sin instructores la cuenta corriente y el selector quedarían incompletos sin que se note.
   * Devuelve `false` si una carga más nueva la reemplazó.
   */
  private async fetchData(token: number, branchId: number | null): Promise<boolean> {
    let advancesQuery = this.supabase.client
      .from('instructor_advances')
      .select(
        'id, date, amount, reason, description, status, instructor_id, instructors!inner(id, type, users!inner(first_names, paternal_last_name, branch_id))',
      )
      .order('date', { ascending: false });
    let instructorsQuery = this.supabase.client
      .from('instructors')
      .select('id, type, users!inner(first_names, paternal_last_name, branch_id)')
      .eq('active', true)
      .order('users(paternal_last_name)', { ascending: true });

    if (branchId !== null) {
      advancesQuery = advancesQuery.eq('instructors.users.branch_id', branchId);
      instructorsQuery = instructorsQuery.eq('users.branch_id', branchId);
    }

    const [advancesRes, instructorsRes] = await Promise.all([advancesQuery, instructorsQuery]);

    const advances = assertReadOk(advancesRes) ?? [];
    const instructors = assertReadOk(instructorsRes) ?? [];

    if (!this.cargaGuard.isCurrent(token)) return false;

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
    for (const instr of instructors) {
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
    return true;
  }

  // ── Mutaciones ────────────────────────────────────────────────────────────

  /**
   * Guarda lo que escribió el usuario, no un valor calculado con lo visible: `refreshFailed` no la
   * bloquea (la BD valida). No toca `_error`, que es solo de la carga. Si el refresco posterior
   * falla, el anticipo igual quedó guardado: es éxito, y la pantalla pasa al caso B.
   */
  async registrarAnticipo(payload: RegistrarAnticipoPayload): Promise<boolean> {
    const user = this.auth.currentUser();
    if (!user) {
      this.toast.error('No hay sesión activa.');
      return false;
    }
    this._isSaving.set(true);
    try {
      const { error } = await this.supabase.client.from('instructor_advances').insert({
        instructor_id: payload.instructorId,
        date: payload.date,
        amount: payload.amount,
        reason: payload.reason || null,
        description: payload.description || null,
        status: 'pending',
        registered_by: user.dbId ?? null,
        payment_method: payload.paymentMethod ?? 'efectivo',
      });
      if (error) throw error;
      this.notifyAnticipoRegistrado(payload.instructorId, payload.amount);
      this.toast.success('Anticipo registrado correctamente.');
      await this.refreshSilently();
      return true;
    } catch (err) {
      // fix-445-m: el error de supabase-js no es `instanceof Error`; antes un rechazo de la BD
      // (p. ej. caja del día ya cerrada) salía siempre como el mensaje genérico.
      // Solo toast: `error` es el de la carga y la página lo muestra como "Error al cargar anticipos".
      this.toast.error(toFriendlyDbMessage(err, 'Error al registrar el anticipo.'));
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Notifica al instructor que se le registró un anticipo (spec 0025, AC4).
   * Fire-and-forget: un fallo nunca revierte el registro ya confirmado.
   */
  private notifyAnticipoRegistrado(instructorId: number, amount: number): void {
    if (amount <= 0) return;

    this.resolveInstructorUserId(instructorId)
      .then((userId) => {
        if (!userId) return;
        this.notifications
          .notifyUsers([userId], {
            subject: 'Anticipo registrado',
            message: `Se registró un anticipo de $${amount}.`,
            referenceType: 'payment',
          })
          .catch(() => this.toast.warning('No se pudo notificar al instructor'));
      })
      .catch(() => {
        // Resolución de destinatario falló (red/RLS) — no rompe el registro (AC-E1).
      });
  }

  /**
   * Resuelve `instructors.id → users.id` para poder notificar al instructor. Solo sirve al aviso
   * posterior a un anticipo ya guardado: si esta lectura falla se omite la notificación y no se
   * toca ni el resultado del guardado ni el estado de carga.
   */
  private async resolveInstructorUserId(instructorId: number): Promise<number | null> {
    const { data, error } = await this.supabase.client
      .from('instructors')
      .select('user_id')
      .eq('id', instructorId)
      .single();
    if (error || !data) return null;
    return (data as { user_id: number }).user_id;
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
