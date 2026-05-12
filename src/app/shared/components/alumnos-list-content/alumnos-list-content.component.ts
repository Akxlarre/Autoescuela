import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  inject,
  viewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

// Shared Components
import { IconComponent } from '../icon/icon.component';
import { KpiCardVariantComponent } from '../kpi-card/kpi-card-variant.component';
import { ActionKpiCardComponent } from '../kpi-card/action-kpi-card.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';

// Directives
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';

// Services
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

// Features
import { SecretariaMatriculaComponent } from '@features/secretaria/matricula/secretaria-matricula.component';
import { AlumnosPorVencerDrawerComponent } from '../alumnos-por-vencer-drawer/alumnos-por-vencer-drawer.component';

// Models
import type {
  AlumnoTableRow,
  AlumnoExpediente,
  AlumnoStatus,
} from '@core/models/ui/alumno-table-row.model';

export interface AlumnoExportRequest {
  format: 'pdf' | 'excel';
  search: string;
  curso: string;
  estado: string;
  expediente: string;
}

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
  icon: 'users' | 'user-check' | 'circle-alert';
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
    SelectModule,
    TagModule,
    TooltipModule,
    IconComponent,
    KpiCardVariantComponent,
    ActionKpiCardComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
    BentoGridLayoutDirective,
    AnimateInDirective,
    SectionHeroComponent,
  ],
  template: `
    <div
      class="bento-grid"
      appBentoGridLayout
      #bentoGrid
      aria-label="Panel de alumnos"
      [class.force-compact]="layoutDrawer.isOpen()"
    >
      <app-section-hero
        title="Alumnos"
        [subtitle]="heroSubtitle()"
        [chips]="heroChips()"
        [actions]="heroActions()"
        [backClickable]="trashView()"
        backLabel="Alumnos"
        (backClicked)="trashViewToggled.emit()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- KPIs — usando el mismo patrón que el Dashboard -->
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
          [value]="alumnosPorVencer()"
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
      <!-- (End FAQs/KPIs) -->

      <!-- Filtros y Tabla (Dual-Viewport) -->
      <div
        class="bento-banner card p-0 overflow-hidden shadow-sm dual-viewport-container"
        #tableCard
      >
        <!-- Toolbar de la tabla -->
        <div
          class="flex flex-wrap items-center gap-3 p-4"
          style="border-bottom: 1px solid var(--border-default)"
        >
          <!-- Buscador -->
          <div class="relative flex-1 min-w-52 max-w-xs">
            <app-icon
              name="search"
              [size]="15"
              class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style="color: var(--text-muted)"
            />
            <input
              type="text"
              placeholder="Buscar por nombre, RUT o Nº Expediente..."
              class="w-full h-9 pl-8 pr-3 text-sm rounded-lg border outline-none transition-colors"
              style="border-color: var(--border-default); background: var(--bg-surface); color: var(--text-primary)"
              data-llm-description="Search students by name, RUT or file number"
              [(ngModel)]="searchTerm"
            />
          </div>

          <!-- Filtros -->
          <p-select
            [options]="cursos"
            [(ngModel)]="selectedCurso"
            optionLabel="label"
            optionValue="value"
            class="h-9"
            data-llm-description="Filter students by course type"
          />
          <p-select
            [options]="estados"
            [(ngModel)]="selectedEstado"
            optionLabel="label"
            optionValue="value"
            class="h-9"
            data-llm-description="Filter students by enrollment status"
          />
          <p-select
            [options]="expedienteOpciones"
            [(ngModel)]="selectedExpediente"
            optionLabel="label"
            optionValue="value"
            class="h-9"
            data-llm-description="Filter students by file completion status"
          />

          <!-- Exportar (dropdown) -->
          <div class="relative ml-auto">
            <button
              type="button"
              class="btn-secondary flex items-center gap-2 text-sm disabled:opacity-60"
              [disabled]="isExporting()"
              (click)="exportMenuOpen.set(!exportMenuOpen())"
              data-llm-action="open-export-menu"
            >
              @if (isExporting()) {
                <app-icon name="loader-circle" [size]="16" class="animate-spin" />
              } @else {
                <app-icon name="download" [size]="16" />
              }
              Exportar
              <app-icon name="chevron-down" [size]="14" />
            </button>
            @if (exportMenuOpen()) {
              <div class="fixed inset-0 z-10" (click)="exportMenuOpen.set(false)"></div>
              <div class="export-menu">
                <button
                  type="button"
                  class="export-menu-item"
                  (click)="requestExport('excel')"
                  data-llm-action="export-students-excel"
                >
                  <app-icon name="table-2" [size]="16" />
                  Exportar como Excel
                </button>
                <button
                  type="button"
                  class="export-menu-item"
                  (click)="requestExport('pdf')"
                  data-llm-action="export-students-pdf"
                >
                  <app-icon name="file-text" [size]="16" />
                  Exportar como PDF
                </button>
              </div>
            }
          </div>
        </div>

        <!-- Tabla -->
        @if (isLoading()) {
          <div class="viewport-content bg-surface" appAnimateIn>
            <!-- VISTA 1: TABLA SKELETON (Oculta cuando se comprime) -->
            <div class="desktop-view hide-on-squeeze p-4 space-y-0">
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

            <!-- VISTA 2: TARJETAS SKELETON (Visible cuando se comprime o móvil) -->
            <div class="mobile-view show-on-squeeze p-4 md:p-6 bg-surface">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                @for (card of [1, 2, 3, 4, 5, 6]; track card) {
                  <div
                    class="flex flex-col bg-base border border-border-subtle rounded-xl overflow-hidden shadow-sm"
                  >
                    <!-- Header -->
                    <div
                      class="p-4 border-b border-border-subtle flex items-start justify-between gap-3"
                    >
                      <div class="flex items-center gap-3 min-w-0 flex-1">
                        <app-skeleton-block
                          variant="circle"
                          width="40px"
                          height="40px"
                          class="shrink-0"
                        />
                        <div class="flex flex-col gap-2 w-full">
                          <app-skeleton-block variant="text" width="80%" height="12px" />
                          <app-skeleton-block variant="text" width="60%" height="10px" />
                        </div>
                      </div>
                      <app-skeleton-block
                        variant="rect"
                        width="48px"
                        height="20px"
                        class="shrink-0"
                      />
                    </div>

                    <!-- Body -->
                    <div class="p-4 grid grid-cols-2 gap-y-5 gap-x-4 bg-surface">
                      <div class="flex flex-col gap-1.5">
                        <app-skeleton-block variant="text" width="40%" height="10px" />
                        <app-skeleton-block variant="text" width="80%" height="12px" />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <app-skeleton-block variant="text" width="60%" height="10px" />
                        <app-skeleton-block variant="rect" width="70px" height="20px" />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <app-skeleton-block variant="text" width="45%" height="10px" />
                        <app-skeleton-block variant="text" width="65%" height="12px" />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <app-skeleton-block variant="text" width="50%" height="10px" />
                        <app-skeleton-block variant="text" width="70%" height="12px" />
                      </div>
                    </div>

                    <!-- Footer Actions -->
                    <div
                      class="p-2 bg-transparent border-t border-border-subtle flex items-center justify-end gap-1"
                    >
                      <app-skeleton-block variant="circle" width="32px" height="32px" />
                      <app-skeleton-block variant="circle" width="32px" height="32px" />
                      <app-skeleton-block variant="circle" width="32px" height="32px" />
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        } @else {
          <!-- Contenido principal interactivo -->
          <div class="viewport-content bg-surface" appAnimateIn>
            <!-- VISTA 1: LA TABLA CLÁSICA (Oculta cuando se comprime) -->
            <div class="desktop-view hide-on-squeeze">
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
                  <tr
                    class="bg-subtle text-text-muted uppercase text-xs tracking-wider font-medium text-left"
                  >
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
                            >{{ alumno.apellido }} {{ alumno.nombre }}</span
                          >
                          <span class="text-xs text-text-muted">{{ alumno.email }}</span>
                        </div>
                      </div>
                    </td>
                    <!-- RUT -->
                    <td class="text-xs font-medium text-text-secondary font-mono">
                      {{ alumno.rut }}
                    </td>
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
                        styleClass="text-xs font-bold px-2 py-0.5 bg-transparent border border-current"
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
                      <div
                        class="inline-flex items-center justify-end gap-0.5 p-0.5 rounded-lg hover:bg-elevated hover:shadow-sm border border-transparent transition-all"
                      >
                        @if (trashView()) {
                          <!-- Vista Papelera: solo Restaurar -->
                          <button
                            pButton
                            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                            style="color: var(--state-success)"
                            pTooltip="Restaurar alumno"
                            (click)="restaurarRequested.emit(alumno.id)"
                            data-llm-action="restore-student-row"
                          >
                            <app-icon name="rotate-ccw" [size]="16" />
                          </button>
                        } @else {
                          <!-- Vista Normal: Ver / Certificado / PDF / Archivar -->
                          <button
                            pButton
                            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                            pTooltip="Ver ficha"
                            [routerLink]="[basePath() + '/alumnos/' + alumno.id]"
                          >
                            <app-icon name="eye" [size]="16" />
                          </button>
                          <button
                            pButton
                            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                            pTooltip="Exportar Ficha PDF"
                            [disabled]="isGeneratingFicha() === alumno.enrollmentId"
                            (click)="exportarFicha(alumno)"
                          >
                            @if (isGeneratingFicha() === alumno.enrollmentId) {
                              <app-icon name="loader-circle" [size]="16" class="animate-spin" />
                            } @else {
                              <app-icon name="download" [size]="16" />
                            }
                          </button>
                          <button
                            pButton
                            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                            style="color: var(--state-error)"
                            pTooltip="Archivar alumno"
                            (click)="archivarRequested.emit(alumno.id)"
                            data-llm-action="archive-student-row"
                          >
                            <app-icon name="trash-2" [size]="16" />
                          </button>
                        }
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
            </div>

            <!-- VISTA 2: TARJETAS APILADAS (Visible cuando se comprime o en móvil) -->
            <div class="mobile-view show-on-squeeze p-4 md:p-6 bg-surface">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                @for (alumno of filteredAlumnos(); track alumno.id) {
                  <div
                    class="flex flex-col bg-base border border-border-subtle rounded-xl overflow-hidden shadow-sm hover:border-brand hover:-translate-y-0.5 hover:shadow-md transition-all duration-300"
                  >
                    <!-- Header -->
                    <div
                      class="p-4 border-b border-border-subtle flex items-start justify-between gap-3"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div
                          class="shrink-0 w-10 h-10 rounded-full bg-surface shadow-sm flex items-center justify-center border border-border-default text-text-primary font-black text-sm uppercase"
                        >
                          {{ alumno.nombre[0] }}{{ alumno.apellido[0] }}
                        </div>
                        <div class="flex flex-col min-w-0">
                          <span class="font-bold text-sm text-text-primary truncate"
                            >{{ alumno.apellido }} {{ alumno.nombre }}</span
                          >
                          <span class="text-xs text-text-muted truncate">{{ alumno.email }}</span>
                        </div>
                      </div>
                      <p-tag
                        [value]="alumno.status"
                        [severity]="getStatusSeverity(alumno.status)"
                        styleClass="text-[10px] font-bold px-2 py-0.5 shrink-0"
                      ></p-tag>
                    </div>

                    <!-- Body -->
                    <div class="p-4 grid grid-cols-2 gap-y-5 gap-x-4 text-sm bg-surface">
                      <div class="flex flex-col">
                        <span class="text-[11px] text-text-muted mb-0.5">RUT</span>
                        <span class="font-medium text-text-secondary font-mono text-xs">{{
                          alumno.rut
                        }}</span>
                      </div>
                      <div class="flex flex-col">
                        <span class="text-[11px] text-text-muted mb-0.5">Expediente</span>
                        @let exp = getExpedienteStatus(alumno.expediente);
                        <div class="flex items-center">
                          <p-tag
                            [value]="exp.label + ' · ' + exp.count"
                            [severity]="exp.severity"
                            styleClass="text-[10px] font-bold px-1.5 py-0.5 bg-transparent border border-current"
                          ></p-tag>
                        </div>
                      </div>
                      <div class="flex flex-col">
                        <span class="text-[11px] text-text-muted mb-0.5">Curso</span>
                        <span class="font-medium text-text-secondary text-xs truncate">{{
                          alumno.cursa
                        }}</span>
                      </div>
                      <div class="flex flex-col">
                        <span class="text-[11px] text-text-muted mb-0.5">Ingreso</span>
                        <span class="font-medium text-text-secondary text-xs">{{
                          alumno.fechaIngreso
                        }}</span>
                      </div>
                    </div>

                    <!-- Footer Actions -->
                    <div
                      class="p-2 bg-transparent border-t border-border-subtle flex items-center justify-end gap-0.5"
                    >
                      @if (trashView()) {
                        <!-- Vista Papelera: solo Restaurar -->
                        <button
                          pButton
                          class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
                          style="color: var(--state-success)"
                          pTooltip="Restaurar alumno"
                          (click)="restaurarRequested.emit(alumno.id)"
                          data-llm-action="restore-student-card"
                        >
                          <app-icon name="rotate-ccw" [size]="16" />
                        </button>
                      } @else {
                        <!-- Vista Normal -->
                        <button
                          pButton
                          class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
                          pTooltip="Ver ficha"
                          [routerLink]="[basePath() + '/alumnos/' + alumno.id]"
                        >
                          <app-icon name="eye" [size]="16" />
                        </button>
                        <button
                          pButton
                          class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
                          pTooltip="Exportar Ficha PDF"
                          [disabled]="isGeneratingFicha() === alumno.enrollmentId"
                          (click)="exportarFicha(alumno)"
                        >
                          @if (isGeneratingFicha() === alumno.enrollmentId) {
                            <app-icon name="loader-circle" [size]="16" class="animate-spin" />
                          } @else {
                            <app-icon name="download" [size]="16" />
                          }
                        </button>
                        <button
                          pButton
                          class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
                          style="color: var(--state-error)"
                          pTooltip="Archivar alumno"
                          (click)="archivarRequested.emit(alumno.id)"
                          data-llm-action="archive-student-card"
                        >
                          <app-icon name="trash-2" [size]="16" />
                        </button>
                      }
                    </div>
                  </div>
                } @empty {
                  <div class="col-span-full py-8">
                    <app-empty-state
                      icon="search"
                      message="No se encontraron alumnos"
                      subtitle="Intenta ajustar los criterios de búsqueda o filtros."
                      actionLabel="Limpiar filtros"
                      actionIcon="refresh-cw"
                      (action)="resetFilters()"
                    />
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      /* Container Queries para Dual-Viewport Render */
      .dual-viewport-container {
        container-type: inline-size;
        container-name: listContainer;
      }

      /* Por defecto (Pantallas grandes): Mostramos tabla, ocultamos tarjetas */
      .show-on-squeeze {
        display: none;
      }

      @container listContainer (max-width: 900px) {
        .hide-on-squeeze {
          display: none !important;
        }
        .show-on-squeeze {
          display: block !important;
        }
      }

      .export-menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 20;
        min-width: 200px;
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
        overflow: hidden;
      }

      .export-menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 10px 14px;
        font-size: 13px;
        color: var(--text-primary);
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: left;
        transition: background var(--duration-fast);
      }

      .export-menu-item:hover {
        background: var(--bg-elevated);
      }
    `,
  ],
})
export class AlumnosListContentComponent implements AfterViewInit {
  // ── Inputs ──────────────────────────────────────────────────────────────
  readonly alumnos = input.required<AlumnoTableRow[]>();
  readonly isLoading = input(false);
  readonly isExporting = input(false);
  readonly isGeneratingFicha = input<number | false>(false);
  readonly trashView = input(false);
  readonly basePath = input<string>('/app/secretaria');
  readonly alumnosPorVencer = input<number>(0);

  // ── Outputs ─────────────────────────────────────────────────────────────
  readonly refreshRequested = output<void>();
  readonly preInscritosRequested = output<void>();
  readonly archivarRequested = output<string>();
  readonly restaurarRequested = output<string>();
  readonly trashViewToggled = output<void>();
  readonly exportRequested = output<AlumnoExportRequest>();
  readonly fichaExportRequested = output<number>();

  // ── Internal UI state ────────────────────────────────────────────────────
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');
  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroRef');

  readonly heroSubtitle = computed(() =>
    this.trashView() ? 'Papelera — Alumnos archivados' : 'Listado de alumnos de la escuela',
  );

  readonly heroChips = computed((): SectionHeroChip[] => [
    { label: `${this.totalAlumnos()} alumnos`, icon: 'users', style: 'default' },
  ]);

  readonly heroActions = computed((): SectionHeroAction[] => {
    const path = this.basePath();
    const isTrash = this.trashView();
    return [
      {
        id: 'historial',
        label: 'Ex-Alumnos',
        icon: 'archive',
        primary: false,
        route: `${path}/ex-alumnos`,
      },
      { id: 'preinscritos', label: 'Pre-inscritos', icon: 'users', primary: false },
      {
        id: 'papelera',
        label: 'Papelera',
        icon: 'trash-2',
        primary: false,
        danger: isTrash,
      },
      {
        id: 'nueva-matricula',
        label: 'Nueva Matrícula',
        icon: 'plus',
        primary: true,
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
      icon: 'circle-alert',
      color: 'warning',
    },
  ]);

  searchTerm = '';
  selectedCurso = '';
  selectedEstado = '';
  selectedExpediente = '';
  isDrawerOpen = signal(false);
  readonly exportMenuOpen = signal(false);

  readonly cursos = [
    { label: 'Todos los cursos', value: '' },
    { label: 'Clase B', value: 'Clase B' },
    { label: 'Clase B + SENCE', value: 'Clase B + SENCE' },
    { label: 'Profesional A2', value: 'Profesional A2' },
    { label: 'Profesional A3', value: 'Profesional A3' },
    { label: 'Profesional A4', value: 'Profesional A4' },
    { label: 'Profesional A5', value: 'Profesional A5' },
  ];
  readonly estados = [
    { label: 'Todos los estados', value: '' },
    { label: 'Activo', value: 'Activo' },
    { label: 'Finalizado', value: 'Finalizado' },
    { label: 'Retirado', value: 'Retirado' },
    { label: 'Pre-inscrito', value: 'Pre-inscrito' },
    { label: 'Pendiente Pago', value: 'Pendiente Pago' },
    { label: 'Docs Pendientes', value: 'Docs Pendientes' },
    { label: 'Inactivo', value: 'Inactivo' },
  ];
  readonly expedienteOpciones = [
    { label: 'Expediente: Todos', value: '' },
    { label: 'Completo', value: 'Completo' },
    { label: 'Parcial', value: 'Parcial' },
    { label: 'Pendiente', value: 'Pendiente' },
  ];

  constructor() {}

  ngAfterViewInit(): void {
    const hero = this.heroRef();
    const grid = this.bentoGrid();

    if (hero) this.gsap.animateHero(hero.nativeElement);
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
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
    this.selectedCurso = '';
    this.selectedEstado = '';
    this.selectedExpediente = '';
  }

  openPorVencerDrawer(): void {
    if (!this.isLoading()) {
      this.layoutDrawer.open(
        AlumnosPorVencerDrawerComponent,
        'Alumnos con Cuotas por Vencer',
        'alert-triangle',
      );
    }
  }

  handleHeroAction(actionId: string): void {
    switch (actionId) {
      case 'preinscritos':
        this.preInscritosRequested.emit();
        break;
      case 'papelera':
        this.trashViewToggled.emit();
        break;
      case 'nueva-matricula':
        this.openNuevaMatriculaDrawer();
        break;
      default:
        break;
    }
  }

  openNuevaMatriculaDrawer(): void {
    this.layoutDrawer.open(SecretariaMatriculaComponent, 'Nueva Matrícula', 'plus');
  }

  requestExport(format: 'pdf' | 'excel'): void {
    this.exportMenuOpen.set(false);
    this.exportRequested.emit({
      format,
      search: this.searchTerm,
      curso: this.selectedCurso,
      estado: this.selectedEstado,
      expediente: this.selectedExpediente,
    });
  }

  exportarFicha(alumno: AlumnoTableRow): void {
    if (!alumno.enrollmentId) return;
    this.fichaExportRequested.emit(alumno.enrollmentId);
  }
}
