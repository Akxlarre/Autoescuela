import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  effect,
  inject,
  viewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

// Shared Components
import { IconComponent } from '../icon/icon.component';
import { KpiCardVariantComponent } from '../kpi-card/kpi-card-variant.component';
import { ActionKpiCardComponent } from '../kpi-card/action-kpi-card.component';
import { DrawerComponent } from '../drawer/drawer.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';

// Directives
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';

// Services
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

// Models
import type {
  AlumnoTableRow,
  AlumnoExpediente,
  AlumnoStatus,
} from '@core/models/ui/alumno-table-row.model';

interface ExpedienteStatus {
  label: 'Completo' | 'Parcial' | 'Pendiente';
  severity: 'success' | 'warn' | 'danger';
  count: string;
}

/** Forma de KPI para app-kpi-card-variant (compatible con Dashboard). */
interface AlumnoKpiItem {
  id: string;
  label: string;
  value: number;
  icon: 'users' | 'user-check' | 'alert-circle';
  color: 'default' | 'success' | 'warning' | 'error';
  accent?: boolean;
  suffix?: string;
  prefix?: string;
  trend?: number;
  trendLabel?: string;
  subValue?: string;
}

@Component({
  selector: 'app-alumnos-list-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TagModule,
    TooltipModule,
    IconComponent,
    KpiCardVariantComponent,
    ActionKpiCardComponent,
    DrawerComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
    BentoGridLayoutDirective,
    SectionHeroComponent,
  ],
  template: `
    <div class="flex flex-col gap-8">
      <app-section-hero
        title="Alumnos"
        subtitle="Listado de alumnos de la escuela"
        [chips]="heroChips()"
        [actions]="heroActions()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- KPIs — bento-grid--four-equal: 4 celdas iguales que ocupan todo el ancho (sin espacio vacío a la derecha) -->
      <section
        class="bento-grid bento-grid--four-equal"
        appBentoGridLayout
        #bentoGrid
        aria-label="Métricas de alumnos"
      >
        @for (kpi of alumnosKpis(); track kpi.id) {
          <div class="bento-square">
            <app-kpi-card-variant
              [label]="kpi.label"
              [value]="kpi.value"
              [suffix]="kpi.suffix ?? ''"
              [prefix]="kpi.prefix ?? ''"
              [trend]="kpi.trend"
              [trendLabel]="kpi.trendLabel ?? ''"
              [subValue]="kpi.subValue ?? ''"
              [accent]="kpi.accent ?? false"
              [icon]="kpi.icon"
              [color]="kpi.color"
              [loading]="isLoading()"
            />
          </div>
        }
        <div class="bento-square">
          <app-action-kpi-card
            label="Por Vencer"
            [value]="alumnosPorVencer().length"
            icon="alert-triangle"
            size="md"
            color="error"
            [pulse]="true"
            [loading]="isLoading()"
            (click)="openPorVencerDrawer()"
          >
            <div
              footer
              class="flex items-center gap-1 text-xs text-text-muted mt-2 group-hover:text-text-primary transition-colors"
            >
              <span>Ver detalles</span>
              <app-icon name="arrow-right" [size]="12" />
            </div>
          </app-action-kpi-card>
        </div>
      </section>

      <!-- Filtros y Tabla -->
      <div class="card p-0 overflow-hidden shadow-sm" #tableCard>
        <!-- Toolbar de la tabla -->
        <div
          class="p-4 border-b border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface"
        >
          <div class="flex flex-wrap items-center gap-3">
            <span class="p-input-icon-left w-full md:w-80 relative">
              <app-icon
                name="search"
                [size]="16"
                class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10"
              />
              <input
                pInputText
                type="text"
                placeholder="Buscar por nombre, RUT o Nº Expediente..."
                class="w-full pl-10 h-10 rounded-lg border-border-subtle hover:border-border-strong focus:border-brand bg-base"
                [(ngModel)]="searchTerm"
              />
            </span>
            <p-select
              [options]="cursos"
              [(ngModel)]="selectedCurso"
              placeholder="Todos los cursos"
              class="w-full md:w-48 h-10"
            ></p-select>
            <p-select
              [options]="estados"
              [(ngModel)]="selectedEstado"
              placeholder="Todos los estados"
              class="w-full md:w-44 h-10"
            ></p-select>
            <!-- RF-085: Filtro por expediente -->
            <p-select
              [options]="expedienteOpciones"
              [(ngModel)]="selectedExpediente"
              placeholder="Expediente: Todos"
              class="w-full md:w-44 h-10"
            ></p-select>
          </div>
          <div class="flex items-center gap-2">
            <button pButton label="Exportar" class="p-button-outlined p-button-sm h-10">
              <app-icon name="file-text" [size]="14" class="mr-2" />
            </button>
            <button
              pButton
              label="Actualizar"
              class="p-button-outlined p-button-sm h-10"
              [loading]="isLoading()"
              (click)="refresh()"
            >
              <app-icon name="refresh-cw" [size]="14" class="mr-2" />
            </button>
          </div>
        </div>

        <!-- Tabla -->
        @if (isLoading()) {
          <div class="p-4 space-y-0">
            <!-- Header skeleton -->
            <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
              <app-skeleton-block variant="text" width="15%" height="11px" />
              <app-skeleton-block variant="text" width="9%" height="11px" />
              <app-skeleton-block variant="text" width="9%" height="11px" />
              <app-skeleton-block variant="text" width="9%" height="11px" />
              <app-skeleton-block variant="text" width="11%" height="11px" />
              <app-skeleton-block variant="text" width="7%" height="11px" />
              <app-skeleton-block variant="text" width="9%" height="11px" />
            </div>
            <!-- Row skeletons -->
            @for (row of [1, 2, 3, 4, 5, 6]; track row) {
              <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                <div class="flex items-center gap-3 w-[15%]">
                  <app-skeleton-block variant="circle" width="36px" height="36px" />
                  <div class="flex flex-col gap-1.5 flex-1">
                    <app-skeleton-block variant="text" width="75%" height="12px" />
                    <app-skeleton-block variant="text" width="55%" height="10px" />
                  </div>
                </div>
                <app-skeleton-block variant="text" width="9%" height="12px" />
                <app-skeleton-block variant="text" width="9%" height="12px" />
                <app-skeleton-block variant="rect" width="64px" height="20px" />
                <app-skeleton-block variant="text" width="11%" height="12px" />
                <app-skeleton-block variant="rect" width="56px" height="20px" />
                <app-skeleton-block variant="rect" width="72px" height="20px" />
                <div class="flex items-center gap-1 ml-auto">
                  <app-skeleton-block variant="circle" width="28px" height="28px" />
                  <app-skeleton-block variant="circle" width="28px" height="28px" />
                  <app-skeleton-block variant="circle" width="28px" height="28px" />
                </div>
              </div>
            }
            <!-- Pagination skeleton -->
            <div class="flex items-center justify-between pt-3">
              <app-skeleton-block variant="text" width="210px" height="12px" />
              <div class="flex gap-1">
                <app-skeleton-block variant="rect" width="32px" height="32px" />
                <app-skeleton-block variant="rect" width="32px" height="32px" />
                <app-skeleton-block variant="rect" width="32px" height="32px" />
              </div>
            </div>
          </div>
        } @else {
          <p-table
            [value]="filteredAlumnos()"
            [rows]="10"
            [paginator]="true"
            responsiveLayout="scroll"
            styleClass="p-datatable-sm p-datatable-striped"
            [showCurrentPageReport]="true"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} alumnos"
          >
            <ng-template pTemplate="header">
              <tr class="bg-subtle text-text-muted uppercase text-xs tracking-wider">
                <th class="pl-6 py-4">Alumno</th>
                <th>RUT</th>
                <th>Nº Exp.</th>
                <th>Curso</th>
                <th>Fecha Ingreso</th>
                <th>Estado</th>
                <th>Expediente</th>
                <th class="pr-6 text-right">Acciones</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-alumno>
              <tr class="hover:bg-subtle transition-colors border-b border-border-subtle">
                <!-- Alumno -->
                <td class="pl-6 py-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-9 h-9 rounded-full bg-elevated flex items-center justify-center border border-border-subtle text-text-secondary font-bold text-xs uppercase"
                    >
                      {{ alumno.nombre[0] }}{{ alumno.apellido[0] }}
                    </div>
                    <div class="flex flex-col">
                      <span class="font-bold text-sm text-text-primary"
                        >{{ alumno.nombre }} {{ alumno.apellido }}</span
                      >
                      <span class="text-xs text-text-muted">{{ alumno.email }}</span>
                    </div>
                  </div>
                </td>
                <!-- RUT -->
                <td class="text-xs font-medium text-text-secondary font-mono">{{ alumno.rut }}</td>
                <!-- Nº Expediente -->
                <td class="text-xs text-text-muted font-mono">{{ alumno.nroExpediente }}</td>
                <!-- Curso -->
                <td>
                  <span
                    class="text-xs px-2 py-0.5 rounded-full bg-elevated border border-border-subtle text-text-secondary"
                  >
                    {{ alumno.cursa }}
                  </span>
                </td>
                <!-- Fecha Ingreso -->
                <td class="text-xs text-text-secondary">{{ alumno.fechaIngreso }}</td>
                <!-- Estado -->
                <td>
                  <p-tag
                    [value]="alumno.status"
                    [severity]="getStatusSeverity(alumno.status)"
                    styleClass="text-xs font-bold px-2 py-0.5"
                  ></p-tag>
                </td>
                <!-- RF-085: Expediente (Completo/Parcial/Pendiente) -->
                <td>
                  @let exp = getExpedienteStatus(alumno.expediente);
                  <p-tag
                    [value]="exp.label + ' · ' + exp.count"
                    [severity]="exp.severity"
                    styleClass="text-xs font-bold px-2 py-0.5"
                    [pTooltip]="
                      'CI: ' +
                      (alumno.expediente.ci ? 'Sí' : 'No') +
                      ' | Foto: ' +
                      (alumno.expediente.foto ? 'Sí' : 'No') +
                      ' | Médico: ' +
                      (alumno.expediente.medico ? 'Sí' : 'No') +
                      ' | SEMEP: ' +
                      (alumno.expediente.semep ? 'Sí' : 'No')
                    "
                  ></p-tag>
                </td>
                <!-- Acciones -->
                <td class="pr-6 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <!-- Ver Ficha -->
                    <button
                      pButton
                      class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center"
                      pTooltip="Ver ficha"
                      [routerLink]="[basePath() + '/alumnos/' + alumno.id + '/ficha']"
                    >
                      <app-icon name="eye" [size]="16" />
                    </button>
                    <!-- Certificado -->
                    <button
                      pButton
                      class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center"
                      pTooltip="Certificado"
                      [routerLink]="[basePath() + '/certificados']"
                      [queryParams]="{ alumno: alumno.id }"
                    >
                      <app-icon name="award" [size]="16" />
                    </button>
                    <!-- RF-086: Exportar Ficha PDF -->
                    <button
                      pButton
                      class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center"
                      pTooltip="Exportar Ficha PDF"
                      (click)="exportarFicha(alumno.id)"
                    >
                      <app-icon name="download" [size]="16" />
                    </button>
                  </div>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="8" class="p-0">
                  <app-empty-state
                    icon="search"
                    message="No se encontraron alumnos"
                    subtitle="Intenta ajustar los criterios de búsqueda o filtros."
                    actionLabel="Limpiar filtros"
                    actionIcon="refresh-cw"
                    (action)="resetFilters()"
                  />
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </div>
    </div>

    <!-- Drawer: Alumnos por Vencer -->
    <app-drawer
      [isOpen]="isDrawerOpen()"
      (closed)="isDrawerOpen.set(false)"
      title="Alumnos con Cuotas por Vencer"
      icon="alert-triangle"
      [hasFooter]="true"
    >
      <div class="flex flex-col gap-4 p-1">
        @for (item of alumnosPorVencer(); track item.id) {
          <div
            class="card p-3 flex items-center justify-between hover:bg-subtle transition-all border-l-4 border-l-error"
          >
            <div class="flex flex-col gap-0.5">
              <span class="font-bold text-sm text-text-primary"
                >{{ item.nombre }} {{ item.apellido }}</span
              >
              <span class="text-xs text-text-muted font-mono"
                >{{ item.cursa }} — {{ item.nroExpediente }}</span
              >
              <span class="text-xs text-error font-medium">Vence: {{ item.vencimiento }}</span>
            </div>
            <button
              pButton
              class="p-button-rounded p-button-success p-button-text w-8 h-8 p-0 flex items-center justify-center"
              pTooltip="Contactar"
            >
              <app-icon name="message-circle" [size]="18" />
            </button>
          </div>
        }
      </div>
      <div footer class="w-full flex gap-2">
        <button
          pButton
          label="Descargar Reporte Mora"
          class="p-button-outlined p-button-secondary w-full"
        >
          <app-icon name="download" [size]="16" class="mr-2" />
        </button>
      </div>
    </app-drawer>
  `,
  styles: [],
})
export class AlumnosListContentComponent {
  // ── Inputs ──────────────────────────────────────────────────────────────
  readonly basePath = input.required<string>();
  readonly alumnos = input<AlumnoTableRow[]>([]);
  readonly isLoading = input(false);
  readonly alumnosPorVencer = input<AlumnoTableRow[]>([]);

  // ── Outputs ─────────────────────────────────────────────────────────────
  readonly refreshRequested = output<void>();

  // ── Internal UI state ────────────────────────────────────────────────────
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  readonly heroChips = computed((): SectionHeroChip[] => [
    { label: `${this.totalAlumnos()} alumnos`, icon: 'users', style: 'default' },
  ]);

  readonly heroActions = computed((): SectionHeroAction[] => {
    const path = this.basePath();
    return [
      { id: 'enviar-zoom', label: 'Enviar enlace Zoom', icon: 'video', primary: false },
      {
        id: 'registrar-asistencia',
        label: 'Registrar asistencia',
        icon: 'check-circle',
        primary: false,
      },
      {
        id: 'historial',
        label: 'Historial Ex-Alumnos',
        icon: 'archive',
        primary: false,
        route: `${path}/ex-alumnos`,
      },
      { id: 'preinscritos', label: 'Ver Pre-inscritos', icon: 'users', primary: false },
      {
        id: 'nueva-matricula',
        label: 'Nueva Matrícula',
        icon: 'plus',
        primary: true,
        route: `${path}/matricula`,
      },
    ];
  });

  /** KPIs estáticos para la grilla (Total, Activos, Con deuda). Misma forma que Dashboard. */
  readonly alumnosKpis = computed((): AlumnoKpiItem[] => [
    {
      id: 'total',
      label: 'Total Alumnos',
      value: this.totalAlumnos(),
      icon: 'users',
      color: 'default',
      accent: true,
    },
    {
      id: 'activos',
      label: 'Activos',
      value: this.activos(),
      icon: 'user-check',
      color: 'success',
    },
    {
      id: 'deuda',
      label: 'Con deuda',
      value: this.conDeuda(),
      icon: 'alert-circle',
      color: 'warning',
    },
  ]);

  searchTerm = '';
  selectedCurso: string | null = null;
  selectedEstado: string | null = null;
  selectedExpediente: string | null = null;
  isDrawerOpen = signal(false);

  cursos = ['Clase B', 'Clase B + SENCE', 'Clase A2', 'Profesional'];
  estados = [
    'Activo',
    'Finalizado',
    'Retirado',
    'Pre-inscrito',
    'Pendiente Pago',
    'Docs Pendientes',
    'Inactivo',
  ];
  expedienteOpciones = ['Completo', 'Parcial', 'Pendiente'];

  constructor() {
    effect(() => {
      if (!this.isLoading() && this.bentoGrid()) {
        setTimeout(() => {
          this.gsap.animateBentoGrid(this.bentoGrid()!.nativeElement);
        }, 100);
      }
    });
  }

  filteredAlumnos(): AlumnoTableRow[] {
    return this.alumnos().filter((a) => {
      const term = this.searchTerm.toLowerCase();
      const matchSearch =
        !term ||
        a.nombre.toLowerCase().includes(term) ||
        a.apellido.toLowerCase().includes(term) ||
        a.rut.includes(term) ||
        a.nroExpediente.toLowerCase().includes(term);

      const matchCurso = !this.selectedCurso || a.cursa === this.selectedCurso;
      const matchEstado = !this.selectedEstado || a.status === this.selectedEstado;
      const matchExpediente = (() => {
        if (!this.selectedExpediente) return true;
        const exp = this.getExpedienteStatus(a.expediente);
        return exp.label === this.selectedExpediente;
      })();

      return matchSearch && matchCurso && matchEstado && matchExpediente;
    });
  }

  totalAlumnos(): number {
    return this.alumnos().length;
  }

  activos(): number {
    return this.alumnos().filter((a) => a.status === 'Activo').length;
  }

  conDeuda(): number {
    return this.alumnos().filter((a) => a.pago_por_pagar > 0).length;
  }

  getExpedienteStatus(exp: AlumnoExpediente): ExpedienteStatus {
    const docs = [exp.ci, exp.foto, exp.medico, exp.semep];
    const ok = docs.filter(Boolean).length;
    const total = docs.length;
    const count = `${ok}/${total}`;
    if (ok === total) return { label: 'Completo', severity: 'success', count };
    if (ok === 0) return { label: 'Pendiente', severity: 'danger', count };
    return { label: 'Parcial', severity: 'warn', count };
  }

  getStatusSeverity(
    status: AlumnoStatus | string,
  ): 'success' | 'secondary' | 'info' | 'danger' | 'warn' | undefined {
    switch (status) {
      case 'Activo':
        return 'success';
      case 'Finalizado':
        return 'info';
      case 'Retirado':
        return 'danger';
      case 'Pre-inscrito':
        return 'warn';
      case 'Pendiente Pago':
        return 'warn';
      case 'Docs Pendientes':
        return 'info';
      case 'Inactivo':
        return 'secondary';
      default:
        return 'secondary';
    }
  }

  refresh(): void {
    this.refreshRequested.emit();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCurso = null;
    this.selectedEstado = null;
    this.selectedExpediente = null;
  }

  openPorVencerDrawer(): void {
    if (!this.isLoading()) this.isDrawerOpen.set(true);
  }

  handleHeroAction(actionId: string): void {
    switch (actionId) {
      case 'enviar-zoom':
        this.enviarEnlaceZoom();
        break;
      case 'registrar-asistencia':
        this.registrarAsistenciaZoom();
        break;
      case 'preinscritos':
        // TODO: navegar o abrir vista Pre-inscritos
        break;
      default:
        break;
    }
  }

  // RF-054
  enviarEnlaceZoom(): void {
    const confirmacion = confirm(
      'Enviar Enlace de Zoom — Clase Teórica\n\n' +
        'Esta acción enviará un correo con el enlace de Zoom a todos los alumnos activos de Clase B.\n\n' +
        '¿Confirmar envío masivo?',
    );
    if (confirmacion) {
      alert(
        'Enlaces enviados exitosamente\n\n' +
          '- Correos enviados a alumnos activos\n' +
          '- Enlace: https://zoom.us/j/123456789\n\n' +
          '[Mockup — RF-054]',
      );
    }
  }

  // RF-054
  registrarAsistenciaZoom(): void {
    alert(
      'Registrar Asistencia — Clase Teórica Zoom\n\n' +
        'Pasos para registrar asistencia:\n' +
        '1. Descarga el reporte de asistencia desde Zoom\n' +
        '2. Revisa la lista de nombres/correos de asistentes\n' +
        '3. Marca manualmente quienes asistieron\n\n' +
        '[Mockup — RF-054]',
    );
  }

  // RF-086
  exportarFicha(id: string): void {
    alert(
      `Exportando Ficha de Matricula (${id})...\n\nSe generara un PDF con los datos del alumno y el contrato firmado.\n\n[Mockup — RF-086]`,
    );
  }
}
