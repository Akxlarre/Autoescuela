import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { Button } from 'primeng/button';
import { EliminarAlumnoModalComponent } from '@shared/components/eliminar-alumno-modal/eliminar-alumno-modal.component';
import { AdminInasistenciaDrawerComponent } from './inasistencia-drawer/admin-inasistencia-drawer.component';
import { AdminEditarPerfilDrawerComponent } from './editar-perfil-drawer/admin-editar-perfil-drawer.component';
import { AdminFichaTecnicaComponent } from './components/ficha-tecnica/admin-ficha-tecnica.component';
import { AdminHistorialPagosComponent } from './components/historial-pagos/admin-historial-pagos.component';
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';

@Component({
  selector: 'app-admin-alumno-detalle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    SkeletonBlockComponent,
    SectionHeroComponent,
    Button,
    AdminFichaTecnicaComponent,
    AdminHistorialPagosComponent,
    BentoGridLayoutDirective,
    EliminarAlumnoModalComponent,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout>
      <!-- ── Estado de Carga ── -->
      @if (facade.isLoading()) {
        <div class="bento-hero">
          <app-skeleton-block variant="rect" width="100%" height="180px" />
        </div>
        <div class="bento-tall">
          <app-skeleton-block variant="rect" width="100%" height="260px" />
        </div>
        <div class="bento-wide">
          <app-skeleton-block variant="rect" width="100%" height="120px" />
        </div>
        <div class="bento-wide">
          <app-skeleton-block variant="rect" width="100%" height="120px" />
        </div>
        <div class="bento-banner">
          <app-skeleton-block variant="rect" width="100%" height="80px" />
        </div>
        <div class="bento-hero">
          <app-skeleton-block variant="rect" width="100%" height="320px" />
        </div>

        <!-- ── Estado de Error ── -->
      } @else if (facade.error()) {
        <div class="bento-banner">
          <div class="flex flex-col gap-4">
            <div class="bento-card border-l-4 border-l-error p-5 flex flex-row items-center gap-4">
              <app-icon name="circle-alert" [size]="24" class="text-error shrink-0" />
              <div class="flex flex-col gap-1">
                <p class="font-bold text-lg text-text-primary">Error al cargar la ficha</p>
                <p class="text-sm text-text-secondary">{{ facade.error() }}</p>
              </div>
            </div>
            <p-button
              label="Volver al Listado"
              icon="pi pi-arrow-left"
              [text]="true"
              routerLink="/app/admin/alumnos"
            />
          </div>
        </div>

        <!-- ── Vista Principal ── -->
      } @else if (facade.alumno(); as alumno) {
        <app-section-hero
          [title]="alumno.nombre"
          [contextLine]="alumno.curso + ' · Matrícula ' + alumno.matricula"
          icon="user"
          backRoute="/app/admin/alumnos"
          backLabel="Listado de Alumnos"
          [actions]="heroActions()"
          [chips]="heroChips()"
          (actionClick)="handleHeroAction($event)"
        />

        <!-- Bento Item 1: Info Personal -->
        <div class="bento-card bento-tall">
          <div class="flex flex-col gap-5">
            <div class="flex items-center gap-4">
              <div
                class="w-14 h-14 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center text-text-muted shrink-0"
                aria-hidden="true"
              >
                <app-icon name="user" [size]="24" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-bold text-text-primary truncate">{{ alumno.nombre }}</span>
                <span class="text-xs text-text-secondary">{{ alumno.rut }}</span>
                <span class="text-[10px] font-bold text-brand uppercase tracking-wider mt-0.5"
                  >ESTADO: {{ alumno.estado }}</span
                >
              </div>
            </div>

            <div class="h-px bg-border-subtle w-full"></div>

            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1" data-llm-info="email">
                <span class="kpi-label">EMAIL</span>
                <span class="text-sm font-medium text-text-primary break-all">{{
                  alumno.email
                }}</span>
              </div>
              <div class="flex flex-col gap-1" data-llm-info="phone">
                <span class="kpi-label">TELÉFONO</span>
                <span class="text-sm font-medium text-text-primary">{{ alumno.telefono }}</span>
              </div>
              <div class="flex flex-col gap-1" data-llm-info="ingreso">
                <span class="kpi-label">FECHA DE INGRESO</span>
                <span class="text-sm font-medium text-text-primary">{{ alumno.fechaIngreso }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Bento Item 2: Clases Prácticas -->
        <div class="bento-card bento-wide">
          <div class="bento-card__body bento-card__body--spread">
            <div class="flex items-start justify-between w-full">
              <div class="flex flex-col">
                <span class="text-lg font-bold text-text-primary">Clases Prácticas</span>
                <span class="text-xs text-brand font-medium">
                  {{ facade.progresoPractico().completadas }} de
                  {{ facade.progresoPractico().requeridas }} clases
                </span>
              </div>
              <div class="flex flex-col items-end">
                <span class="kpi-value text-brand" style="font-size: var(--text-3xl)"
                  >{{ facade.porcentajePracticas() }}%</span
                >
                <span class="text-[10px] font-bold text-text-muted uppercase tracking-tighter"
                  >Completado</span
                >
              </div>
            </div>

            <div class="w-full mt-4">
              <div
                class="progress-track"
                role="progressbar"
                [attr.aria-valuenow]="facade.porcentajePracticas()"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="progress-fill-brand transition-all duration-700"
                  [style.width.%]="facade.porcentajePracticas()"
                >
                  @if (facade.porcentajePracticas() > 15) {
                    <span class="progress-label-inline">
                      {{ facade.progresoPractico().completadas }} /
                      {{ facade.progresoPractico().requeridas }}
                    </span>
                  }
                </div>
              </div>
              <div
                class="flex items-center justify-between mt-2 text-[11px] font-bold uppercase tracking-wider"
              >
                <span class="text-brand">{{ facade.progresoPractico().completadas }} OK</span>
                <span class="text-text-muted">{{ restantesPracticas() }} Pendientes</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Bento Item 3: Clases Teóricas -->
        <div class="bento-card bento-wide">
          <div class="bento-card__body bento-card__body--spread">
            <div class="flex items-start justify-between w-full">
              <div class="flex flex-col">
                <span class="text-lg font-bold text-text-primary">Asistencia Teórica</span>
                <span class="text-xs text-state-success font-medium">
                  {{ facade.progresoTeorico().completadas }} de
                  {{ facade.progresoTeorico().requeridas }} asistidas
                </span>
              </div>
              <div class="flex flex-col items-end">
                <span class="kpi-value text-state-success" style="font-size: var(--text-3xl)"
                  >{{ facade.porcentajeTeoricas() }}%</span
                >
                <span class="text-[10px] font-bold text-text-muted uppercase tracking-tighter"
                  >Asistencia</span
                >
              </div>
            </div>

            <div class="w-full mt-4">
              <div
                class="progress-track"
                role="progressbar"
                [attr.aria-valuenow]="facade.porcentajeTeoricas()"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="progress-fill-success transition-all duration-700"
                  [style.width.%]="facade.porcentajeTeoricas()"
                >
                  @if (facade.porcentajeTeoricas() > 15) {
                    <span class="progress-label-inline">
                      {{ facade.progresoTeorico().completadas }} /
                      {{ facade.progresoTeorico().requeridas }}
                    </span>
                  }
                </div>
              </div>
              <div
                class="flex items-center justify-between mt-2 text-[11px] font-bold uppercase tracking-wider"
              >
                <span class="text-state-success"
                  >{{ facade.progresoTeorico().completadas }} OK</span
                >
                <span class="text-text-muted">{{ restantesTeoricas() }} Pendientes</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Bento Item 4: Inasistencias (Banner) -->
        <div
          class="bento-card bento-banner"
          style="background: var(--state-warning-bg); border-color: var(--state-warning-border)"
        >
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <div
                class="w-10 h-10 rounded-xl bg-bg-surface border border-state-warning-border flex items-center justify-center text-state-warning shadow-sm"
              >
                <app-icon name="alert-triangle" [size]="20" />
              </div>
              <div class="flex flex-col">
                <span class="font-bold text-text-primary">Inasistencias Registradas</span>
                <span class="text-xs text-text-secondary">
                  @if (facade.inasistencias().length > 0) {
                    Se han detectado {{ facade.inasistencias().length }} registros que requieren
                    seguimiento.
                  } @else {
                    No hay inasistencias registradas hasta la fecha.
                  }
                </span>
              </div>
            </div>
            <p-button
              label="Registrar Nueva"
              icon="pi pi-plus"
              size="small"
              severity="warn"
              (onClick)="openInasistenciaDrawer()"
            />
          </div>

          @if (facade.inasistencias().length > 0) {
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
              @for (item of facade.inasistencias().slice(0, 3); track item.id) {
                <div
                  class="flex items-center gap-3 p-3 rounded-lg bg-bg-surface border border-border-subtle shadow-sm transition-all hover:shadow-md"
                >
                  <div class="inas-date-pill !border-none !bg-bg-elevated">
                    <span class="text-[10px] font-bold text-text-secondary">{{ item.fecha }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-xs font-bold text-text-primary truncate m-0 font-display uppercase tracking-tight"
                    >
                      {{ item.documentType }}
                    </p>
                    <p class="text-[10px] text-text-muted truncate m-0 italic">
                      {{ item.description || 'Sin descripción' }}
                    </p>
                  </div>
                  <span class="inas-status-badge" [attr.data-status]="item.status">
                    {{ statusLabel(item.status) }}
                  </span>
                </div>
              }
            </div>
          }
        </div>

        <!-- Bento Item 5: Ficha Técnica (Feature) -->
        <app-admin-ficha-tecnica
          class="bento-hero w-full h-full block"
          [clases]="facade.clasesPracticas()"
          (imprimirFicha)="imprimirFicha()"
        />

        <!-- Bento Item 6: Historial de Pagos (Tall) -->
        <app-admin-historial-pagos
          class="bento-tall w-full h-full block"
          [pagos]="facade.historialPagos()"
          [totalPagado]="alumno.totalPagado"
          [saldoPendiente]="alumno.saldoPendiente"
        />
      }
    </div>

    <!-- Modal de confirmación para archivar alumno -->
    <app-eliminar-alumno-modal
      [visible]="deleteModalVisible()"
      [alumnoNombre]="facade.alumno()?.nombre ?? ''"
      [hasHistory]="deleteHasHistory()"
      [isDeleting]="alumnosFacade.isArchiving()"
      (confirmado)="onConfirmArchivar()"
      (cancelado)="onCancelArchivar()"
    />
  `,
  styles: `
    .kpi-label {
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: 0.05em;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .progress-track {
      width: 100%;
      height: 20px;
      background: var(--bg-subtle);
      border-radius: var(--radius-full);
      overflow: hidden;
    }
    .progress-fill-brand {
      height: 100%;
      background: var(--ds-brand);
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 8px;
      min-width: 40px;
    }
    .progress-fill-success {
      height: 100%;
      background: var(--state-success);
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 8px;
      min-width: 40px;
    }
    .progress-label-inline {
      font-size: 11px;
      font-weight: var(--font-semibold);
      color: #fff;
      white-space: nowrap;
    }

    .inas-status-badge {
      flex-shrink: 0;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      background: var(--bg-elevated);
      color: var(--text-muted);
      border: 1px solid var(--border-subtle);
    }
    .inas-status-badge[data-status='pending'] {
      color: var(--state-warning);
      background: var(--state-warning-bg);
      border-color: var(--state-warning-border);
    }
    .inas-status-badge[data-status='approved'],
    .inas-status-badge[data-status='revisado'] {
      color: var(--state-success);
      background: var(--state-success-bg);
      border-color: var(--state-success-border);
    }
    .inas-status-badge[data-status='rejected'] {
      color: var(--state-error);
      background: var(--state-error-bg);
      border-color: var(--state-error-border);
    }
  `,
})
export class AdminAlumnoDetalleComponent implements OnInit {
  protected readonly facade = inject(AdminAlumnoDetalleFacade);
  protected readonly alumnosFacade = inject(AdminAlumnosFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Estado del modal de borrado ──────────────────────────────────────────────
  protected readonly deleteModalVisible = signal(false);
  protected readonly deleteHasHistory = signal(false);

  // ── Computed: derivados del facade ──────────────────────────────────────────
  protected readonly restantesPracticas = computed(
    () => this.facade.progresoPractico().requeridas - this.facade.progresoPractico().completadas,
  );

  protected readonly restantesTeoricas = computed(
    () => this.facade.progresoTeorico().requeridas - this.facade.progresoTeorico().completadas,
  );

  // ── Secciones fijas: configuración de Hero ───────────────────────────────────
  protected readonly heroActions = computed<SectionHeroAction[]>(() => {
    const alumno = this.facade.alumno();
    if (!alumno) return [];

    const progreso = this.facade.progresoPractico();
    const canEmitCert = progreso.completadas >= progreso.requeridas;

    return [
      { id: 'generar-carnet', label: 'Generar Carnet', icon: 'credit-card', primary: false },
      {
        id: 'generar-certificado',
        label: `Certificado (${progreso.completadas}/${progreso.requeridas})`,
        icon: 'file-text',
        primary: false,
        disabled: !canEmitCert,
      },
      { id: 'editar-alumno', label: 'Editar Perfil', icon: 'user-pen', primary: true },
      {
        id: 'eliminar-alumno',
        label: 'Eliminar Alumno',
        icon: 'trash-2',
        primary: false,
        danger: true,
      },
    ];
  });

  protected readonly heroChips = computed<SectionHeroChip[]>(() => {
    const alumno = this.facade.alumno();
    if (!alumno) return [];
    return [
      {
        label: alumno.estado,
        style: alumno.estado?.toLowerCase() === 'activo' ? 'success' : 'warning',
        icon: 'circle-check',
      },
      { label: 'Matrícula ' + alumno.id, style: 'default', icon: 'hash' },
    ];
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && !isNaN(Number(id))) {
      void this.facade.initialize(Number(id));
    }
  }

  // ── Handlers de Hero ────────────────────────────────────────────────────────
  protected handleHeroAction(actionId: string): void {
    switch (actionId) {
      case 'editar-alumno':
        this.openEditDrawer();
        break;
      case 'generar-carnet':
        console.log('[Detalle] Generar Carnet');
        break;
      case 'generar-certificado':
        console.log('[Detalle] Generar Certificado');
        break;
      case 'eliminar-alumno':
        void this.requestArchivar();
        break;
    }
  }

  // ── Helpers de template ─────────────────────────────────────────────────────
  protected imprimirFicha(): void {
    window.print();
  }

  protected statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Pendiente',
      approved: 'Aprobado',
      revisado: 'Revisado',
      rejected: 'Rechazado',
    };
    return map[status?.toLowerCase()] ?? status ?? 'Pendiente';
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  protected openInasistenciaDrawer(): void {
    this.layoutDrawer.open(
      AdminInasistenciaDrawerComponent,
      'Registrar Inasistencia',
      'alert-triangle',
    );
  }

  protected openEditDrawer(): void {
    this.layoutDrawer.open(
      AdminEditarPerfilDrawerComponent,
      'Editar Perfil del Alumno',
      'user-pen',
    );
  }

  // ── Flujo de archivado ───────────────────────────────────────────────────────
  private get studentId(): number | null {
    const id = this.route.snapshot.paramMap.get('id');
    return id && !isNaN(Number(id)) ? Number(id) : null;
  }

  protected async requestArchivar(): Promise<void> {
    const id = this.studentId;
    if (id === null) return;
    const { hasHistory } = await this.alumnosFacade.checkHistorial(id);
    this.deleteHasHistory.set(hasHistory);
    this.deleteModalVisible.set(true);
  }

  protected async onConfirmArchivar(): Promise<void> {
    const id = this.studentId;
    if (id === null) return;
    try {
      await this.alumnosFacade.archivarAlumno(id);
      void this.router.navigate(['/app/admin/alumnos']);
    } finally {
      this.deleteModalVisible.set(false);
      this.deleteHasHistory.set(false);
    }
  }

  protected onCancelArchivar(): void {
    this.deleteModalVisible.set(false);
    this.deleteHasHistory.set(false);
  }
}
