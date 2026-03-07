import {
  ChangeDetectionStrategy,
  Component,
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
import { KpiCardComponent } from '../kpi-card/kpi-card.component';
import { ActionKpiCardComponent } from '../kpi-card/action-kpi-card.component';
import { DrawerComponent } from '../drawer/drawer.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';

// Directives
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';

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
    KpiCardComponent,
    ActionKpiCardComponent,
    DrawerComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
    BentoGridLayoutDirective,
  ],
  template: `
    <div class="flex flex-col gap-8">
      <!-- Header Seccional -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-text-primary m-0">Alumnos</h1>
          <p class="text-text-muted m-0">Listado de alumnos de la escuela</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <!-- RF-054: Envío masivo de enlace Zoom -->
          <button
            pButton
            label="Enviar enlace Zoom"
            class="p-button-outlined p-button-secondary"
            (click)="enviarEnlaceZoom()"
          >
            <app-icon name="video" [size]="16" class="mr-2" />
          </button>
          <!-- RF-054: Registrar asistencia Zoom -->
          <button
            pButton
            label="Registrar asistencia"
            class="p-button-outlined p-button-secondary"
            (click)="registrarAsistenciaZoom()"
          >
            <app-icon name="check-circle" [size]="16" class="mr-2" />
          </button>
          <!-- RF-105: Ir a Historial Ex-Alumnos -->
          <button
            pButton
            label="Historial Ex-Alumnos"
            class="p-button-outlined p-button-secondary"
            [routerLink]="[basePath() + '/ex-alumnos']"
          >
            <app-icon name="archive" [size]="16" class="mr-2" />
          </button>
          <!-- Ver Pre-inscritos -->
          <button pButton label="Ver Pre-inscritos" class="p-button-outlined p-button-secondary">
            <app-icon name="users" [size]="16" class="mr-2" />
          </button>
          <!-- Nueva Matrícula -->
          <button
            pButton
            label="Nueva Matrícula"
            class="p-button-primary shadow-sm"
            [routerLink]="[basePath() + '/matricula']"
          >
            <app-icon name="plus" [size]="16" class="mr-2" />
          </button>
        </div>
      </div>

      <!-- KPIs Grilla -->
      <div
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        #bentoGrid
        appBentoGridLayout
      >
        @if (isLoading()) {
          <app-skeleton-block height="120px" />
          <app-skeleton-block height="120px" />
          <app-skeleton-block height="120px" />
          <app-skeleton-block height="120px" />
        } @else {
          <app-kpi-card label="Total Alumnos" [value]="totalAlumnos()" icon="users" size="md" />
          <app-kpi-card
            label="Activos"
            [value]="activos()"
            icon="user-check"
            size="md"
            color="success"
            class="relative"
          >
            <span class="indicator-live absolute top-4 right-4"></span>
          </app-kpi-card>
          <app-kpi-card
            label="Con deuda"
            [value]="conDeuda()"
            icon="alert-circle"
            size="md"
            color="warning"
          />
          <app-action-kpi-card
            label="Por Vencer"
            [value]="alumnosPorVencer().length"
            icon="alert-triangle"
            size="md"
            color="error"
            [pulse]="true"
            (click)="isDrawerOpen.set(true)"
          >
            <div
              footer
              class="flex items-center gap-1 text-xs text-text-muted mt-2 group-hover:text-text-primary transition-colors"
            >
              <span>Ver detalles</span>
              <app-icon name="arrow-right" [size]="12" />
            </div>
          </app-action-kpi-card>
        }
      </div>

      <!-- Filtros y Tabla -->
      <div class="card p-0 overflow-hidden shadow-sm" #tableCard>
        <!-- Toolbar de la tabla -->
        <div
          class="p-4 border-b border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bg-surface"
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
                class="w-full pl-10 h-10 rounded-lg border-border-subtle hover:border-border-strong focus:border-primary-500 bg-bg-base"
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
          <div class="p-4 space-y-4">
            <app-skeleton-block height="40px" />
            <app-skeleton-block height="40px" />
            <app-skeleton-block height="40px" />
            <app-skeleton-block height="40px" />
            <app-skeleton-block height="40px" />
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
              <tr class="bg-bg-subtle/50 text-text-muted uppercase text-[10px] tracking-wider">
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
              <tr class="hover:bg-bg-subtle/30 transition-colors border-b border-border-subtle/50">
                <!-- Alumno -->
                <td class="pl-6 py-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-9 h-9 rounded-full bg-bg-elevated flex items-center justify-center border border-border-subtle text-text-secondary font-bold text-xs uppercase"
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
                    class="text-xs px-2 py-0.5 rounded-full bg-bg-elevated border border-border-subtle text-text-secondary"
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
                    styleClass="text-[10px] font-bold px-2 py-0.5"
                  ></p-tag>
                </td>
                <!-- RF-085: Expediente (Completo/Parcial/Pendiente) -->
                <td>
                  @let exp = getExpedienteStatus(alumno.expediente);
                  <p-tag
                    [value]="exp.label + ' · ' + exp.count"
                    [severity]="exp.severity"
                    styleClass="text-[10px] font-bold px-2 py-0.5"
                    [pTooltip]="
                      'CI: ' +
                      (alumno.expediente.ci ? '✓' : '✗') +
                      ' | Foto: ' +
                      (alumno.expediente.foto ? '✓' : '✗') +
                      ' | Médico: ' +
                      (alumno.expediente.medico ? '✓' : '✗') +
                      ' | SEMEP: ' +
                      (alumno.expediente.semep ? '✓' : '✗')
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
                      class="p-button-rounded p-button-text p-button-info p-button-sm w-8 h-8 p-0 flex items-center justify-center"
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
            class="card p-3 flex items-center justify-between hover:bg-bg-subtle/20 transition-all border-l-4 border-l-error"
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

  // RF-054
  enviarEnlaceZoom(): void {
    const confirmacion = confirm(
      'Enviar Enlace de Zoom — Clase Teorica\n\n' +
        'Esta accion enviara un correo con el enlace de Zoom a todos los alumnos activos de Clase B.\n\n' +
        'Confirmar envio masivo?',
    );
    if (confirmacion) {
      alert('Mockup RF-054 — Enlace enviado exitosamente.');
    }
  }

  // RF-054
  registrarAsistenciaZoom(): void {
    alert('Mockup RF-054 — Registrar Asistencia Zoom.');
  }

  // RF-086
  exportarFicha(id: string): void {
    alert(`Mockup RF-086 — Exportando Ficha de Matricula (${id}).`);
  }
}
