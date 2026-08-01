import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthFacade } from '@core/facades/auth.facade';
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';
import { InstructorAlumnosFacade } from '@core/facades/instructor-alumnos.facade';
import { InstructoresFacade } from '@core/facades/instructores.facade';
import type {
  AlumnoQuickAction,
  AlumnoResult,
  InstructorResult,
  SearchResult,
  SearchResultGroup,
} from '@core/models/ui/global-search.model';
import type { UserRole } from '@core/models/ui/user.model';
import { getActionResults } from '@core/utils/search-intents';

/**
 * Construye las acciones rápidas contextuales de un alumno en el Omnibar.
 * admin/secretaria: 4 acciones (Ver Ficha, Registrar Pago, Agendar Clase, Nueva Matrícula).
 * instructor: solo "Ver Ficha" — las otras 3 rutas (`/pagos`, `/agenda`, `/matricula`) no
 * existen bajo `/app/instructor/*`, el instructor no gestiona pagos ni matrículas.
 */
export function buildAlumnoQuickActions(
  detailBase: string,
  rolePrefix: string,
  studentId: string,
  role?: UserRole,
): AlumnoQuickAction[] {
  const verFicha: AlumnoQuickAction = {
    label: 'Ver Ficha',
    icon: 'user',
    actionType: 'view',
    route: [`${detailBase}/${studentId}`],
  };

  if (role === 'instructor') {
    return [verFicha];
  }

  return [
    verFicha,
    {
      label: 'Registrar Pago',
      icon: 'credit-card',
      actionType: 'payment',
      route: [`${rolePrefix}/pagos`],
    },
    {
      label: 'Agendar Clase',
      icon: 'calendar',
      actionType: 'schedule',
      route: [`${rolePrefix}/agenda`],
    },
    {
      label: 'Nueva Matrícula',
      icon: 'user-plus',
      actionType: 'enrollment',
      route: [`${rolePrefix}/matricula`],
    },
  ];
}

@Injectable({ providedIn: 'root' })
export class GlobalSearchFacade {
  private readonly auth = inject(AuthFacade);
  private readonly adminAlumnos = inject(AdminAlumnosFacade);
  private readonly instructorAlumnos = inject(InstructorAlumnosFacade);
  private readonly instructoresFacade = inject(InstructoresFacade);
  private readonly router = inject(Router);

  // ── Estado privado ────────────────────────────────────────────────────────
  private readonly _query = signal('');
  /** Evita re-disparar la carga de datos de negocio en cada keystroke mientras el panel sigue abierto. */
  private _dataLoadTriggered = false;

  // ── Estado público ────────────────────────────────────────────────────────
  readonly query = this._query.asReadonly();

  // ── Computed: prefijo de ruta según rol ──────────────────────────────────
  private readonly rolePrefix = computed(() => {
    const role = this.auth.currentUser()?.role ?? 'admin';
    return `/app/${role}`;
  });

  // ── Computed: acciones por intención ────────────────────────────────────
  readonly actionResults = computed(() => {
    const q = this._query();
    if (!q.trim()) return [];
    const role = this.auth.currentUser()?.role ?? 'admin';
    return getActionResults(q, this.rolePrefix(), role, 4);
  });

  // ── Computed: alumnos encontrados en memoria (scope por rol) ─────────────
  readonly alumnoResults = computed((): AlumnoResult[] => {
    const q = this._query().trim().toLowerCase();
    if (q.length < 2) return [];

    const prefix = this.rolePrefix();
    const role = this.auth.currentUser()?.role ?? 'admin';
    const detailBase = `${prefix}/alumnos`;
    const qRut = q.replace(/[.\-]/g, '');
    const matches = (fullName: string, rut: string): boolean => {
      const rutDigits = rut.replace(/[.\-]/g, '').toLowerCase();
      return fullName.toLowerCase().includes(q) || rutDigits.includes(qRut);
    };

    // instructor: solo sus propios alumnos (ya scopeados por instructor_id en
    // InstructorAlumnosFacade) — nunca los de otro instructor ni de otra sede.
    if (role === 'instructor') {
      return this.instructorAlumnos
        .students()
        .filter((s) => matches(s.name, s.rut))
        .slice(0, 5)
        .map((s) => ({
          type: 'alumno' as const,
          studentId: String(s.studentId),
          label: s.name,
          rut: s.rut,
          status: s.statusLabel,
          route: [`${detailBase}/${s.studentId}`],
          quickActions: buildAlumnoQuickActions(
            detailBase,
            prefix,
            String(s.studentId),
            'instructor',
          ),
        }));
    }

    // admin/secretaria: AdminAlumnosFacade ya aplica scope de sede (resolveBranchScope).
    // alumno (student) y roles desconocidos: sin acceso a datos de otros alumnos.
    if (role !== 'admin' && role !== 'secretaria') return [];

    return this.adminAlumnos
      .alumnos()
      .filter((a) => matches(`${a.nombre} ${a.apellido}`, a.rut))
      .slice(0, 5)
      .map((a) => ({
        type: 'alumno' as const,
        studentId: a.id,
        label: `${a.nombre} ${a.apellido}`,
        rut: a.rut,
        status: a.status,
        route: [`${detailBase}/${a.id}`],
        quickActions: buildAlumnoQuickActions(detailBase, prefix, a.id),
      }));
  });

  // ── Computed: instructores encontrados en memoria (solo admin/secretaria) ──
  readonly instructorResults = computed((): InstructorResult[] => {
    const q = this._query().trim().toLowerCase();
    if (q.length < 2) return [];

    const role = this.auth.currentUser()?.role ?? 'admin';
    // Solo admin/secretaria gestionan instructores. Un instructor no necesita
    // (ni debe) encontrar a sus colegas desde el buscador global.
    if (role !== 'admin' && role !== 'secretaria') return [];

    const prefix = this.rolePrefix();
    const qRut = q.replace(/[.\-]/g, '');

    return this.instructoresFacade
      .instructores()
      .filter((i) => {
        const rutDigits = i.rut.replace(/[.\-]/g, '').toLowerCase();
        return i.nombre.toLowerCase().includes(q) || rutDigits.includes(qRut);
      })
      .slice(0, 5)
      .map((i) => ({
        type: 'instructor' as const,
        instructorId: i.id,
        label: i.nombre,
        rut: i.rut,
        // Sin ficha de detalle de instructor todavía (no existe la ruta `:id`) —
        // navega al listado, ya scopeado por sede igual que el resto de la página.
        route: [`${prefix}/instructores`],
      }));
  });

  // ── Computed: grupos para la UI ──────────────────────────────────────────
  readonly groups = computed((): SearchResultGroup[] => {
    const groups: SearchResultGroup[] = [];
    const actions = this.actionResults();
    const alumnos = this.alumnoResults();
    const instructores = this.instructorResults();
    if (actions.length > 0) {
      groups.push({ label: 'Acciones sugeridas', icon: 'zap', results: actions });
    }
    if (alumnos.length > 0) {
      groups.push({ label: 'Alumnos encontrados', icon: 'users', results: alumnos });
    }
    if (instructores.length > 0) {
      groups.push({
        label: 'Instructores encontrados',
        icon: 'user-check',
        results: instructores,
      });
    }
    return groups;
  });

  readonly hasResults = computed(() => this.groups().some((g) => g.results.length > 0));

  /** true cuando el query tiene contenido pero aún no llega al mínimo para buscar alumnos */
  readonly tooShortForAlumnos = computed(() => this._query().trim().length === 1);

  // ── Acciones ─────────────────────────────────────────────────────────────

  setQuery(q: string): void {
    this._query.set(q);
    if (q.trim().length >= 2 && !this._dataLoadTriggered) {
      this._dataLoadTriggered = true;
      this.loadBusinessData();
    }
  }

  reset(): void {
    this._query.set('');
    this._dataLoadTriggered = false;
  }

  navigate(result: SearchResult): void {
    void this.router.navigate(result.route);
  }

  /**
   * Dispara la carga (SWR) de los datos de negocio indexables según el rol activo.
   * Root cause del H-031: antes de este fix nada llamaba a `AdminAlumnosFacade.initialize()`
   * desde el buscador — el signal `alumnos()` solo tenía datos si el usuario ya había
   * visitado la página de Alumnos en la misma sesión.
   */
  private loadBusinessData(): void {
    const role = this.auth.currentUser()?.role;
    if (role === 'admin' || role === 'secretaria') {
      void this.adminAlumnos.loadAlumnos();
      void this.instructoresFacade.initialize();
    } else if (role === 'instructor') {
      void this.instructorAlumnos.initialize();
    }
  }
}
