import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';

import { IconComponent } from '../icon/icon.component';
import { BadgeComponent } from '../badge/badge.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { avatarPalette } from '@core/utils/avatar-palette';
import {
  getExpedienteStatus,
  getAlumnoStatusBadgeVariant,
  tagSeverityToBadgeVariant,
} from '@core/utils/alumno-status.utils';
import type { AlumnoTableRow } from '@core/models/ui/alumno-table-row.model';

/**
 * AlumnoCard — card de alumno para la vista comprimida/móvil (dual-viewport).
 *
 * Reemplaza el bloque duplicado que vivía inline en `alumnos-list-content` (y su gemelo
 * en `alumnos-profesional-list-content`): mismo dato, mismas acciones, pero sobre `.card`
 * canónico + `.micro-label` en vez de Tailwind ad-hoc, y `app-badge` para TODOS los pills
 * (estado, expediente, curso) en vez de mezclar `p-tag`/`app-badge` en la misma card.
 *
 * Sin accent de borde por severidad (se probó un `border-left` estilo `app-alert-card` y
 * se descartó: con `border-radius` + `overflow-hidden` el borde grueso no sigue la curva
 * de la esquina y se ve recortado/feo, sobre todo en mobile). El estado ya lo comunica el
 * badge — no hace falta una segunda señal redundante.
 */
@Component({
  selector: 'app-alumno-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    TooltipModule,
    ButtonModule,
    IconComponent,
    BadgeComponent,
    SkeletonBlockComponent,
    CardHoverDirective,
  ],
  template: `
    @if (loading()) {
      <div class="card p-0 overflow-hidden flex flex-col">
        <div class="p-4 border-b border-border-subtle flex flex-col gap-2">
          <div class="flex items-center gap-3 min-w-0">
            <app-skeleton-block variant="circle" width="40px" height="40px" class="shrink-0" />
            <div class="flex flex-col gap-2 w-full">
              <app-skeleton-block variant="text" width="80%" height="12px" />
              <app-skeleton-block variant="text" width="60%" height="10px" />
            </div>
          </div>
          <app-skeleton-block variant="rect" width="72px" height="20px" />
        </div>
        <div class="p-4 grid grid-cols-2 gap-y-5 gap-x-4">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="45%" height="10px" />
              <app-skeleton-block variant="text" width="75%" height="12px" />
            </div>
          }
        </div>
        <div class="p-2 border-t border-border-subtle flex items-center justify-end gap-1 mt-auto">
          <app-skeleton-block variant="circle" width="32px" height="32px" />
          <app-skeleton-block variant="circle" width="32px" height="32px" />
          <app-skeleton-block variant="circle" width="32px" height="32px" />
        </div>
      </div>
    } @else {
      <div
        appCardHover
        class="card p-0 overflow-hidden flex flex-col"
        data-llm-description="Ficha resumen de un alumno"
      >
        <!-- Header: avatar+nombre en su fila, badges en la suya — así nunca compiten
             por ancho horizontal (mismo patrón que app-task-card). Un badge de estado
             largo ("Pendiente Pago") + nombre + avatar no entran en una sola fila en
             los anchos angostos del layout dual-viewport (~200px) sin que algo colapse. -->
        <div class="p-4 border-b border-border-subtle flex flex-col gap-2">
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black text-sm uppercase"
              [style.background]="palette().bg"
              [style.color]="palette().text"
            >
              {{ initials() }}
            </div>
            <div class="flex flex-col min-w-0 flex-1">
              <span class="item-title truncate" [pTooltip]="fullName()" tooltipPosition="top">{{
                fullName()
              }}</span>
              <span
                class="text-xs text-text-muted truncate"
                [pTooltip]="alumno().email"
                tooltipPosition="top"
                >{{ alumno().email }}</span
              >
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <app-badge [variant]="statusBadgeVariant()">{{ alumno().status }}</app-badge>
            @if (alumno().cursoCompletoPendienteEgreso) {
              <span
                pTooltip="Certificado enviado y 12/12 prácticas — falta marcar como Ex-Alumno en su ficha"
                tooltipPosition="top"
              >
                <app-badge variant="warning">Curso completo</app-badge>
              </span>
            }
          </div>
        </div>

        <!-- Body -->
        <div class="p-4 grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
          <div class="flex flex-col gap-1">
            <span class="micro-label">RUT</span>
            <span class="font-medium text-text-secondary font-mono text-xs">{{
              alumno().rut
            }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="micro-label">Expediente</span>
            <div
              [pTooltip]="expedienteTooltip()"
              tooltipPosition="top"
              class="flex items-center w-fit"
            >
              <app-badge [variant]="expedienteBadgeVariant()">
                {{ expedienteStatus().label }} · {{ expedienteStatus().count }}
              </app-badge>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <span class="micro-label">Curso</span>
            <div class="flex flex-wrap gap-1">
              @for (curso of alumno().cursos; track curso.nombre) {
                <app-badge [variant]="curso.licenseGroup === 'professional' ? 'brand' : 'neutral'">
                  {{ curso.nombre }}
                </app-badge>
              }
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <span class="micro-label">Ingreso</span>
            <span class="font-medium text-text-secondary text-xs">{{ alumno().fechaIngreso }}</span>
          </div>
        </div>

        <!-- Footer Actions -->
        <div
          class="p-2 bg-transparent border-t border-border-subtle flex items-center justify-end gap-0.5 mt-auto"
        >
          @if (trashView()) {
            <button
              aria-label="Restaurar alumno"
              pButton
              class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:bg-elevated hover:scale-110 active:scale-95 transition-all text-success"
              pTooltip="Restaurar alumno"
              (click)="restaurarRequested.emit(alumno().id)"
              data-llm-action="restore-student-card"
            >
              <app-icon name="rotate-ccw" [size]="16" />
            </button>
          } @else {
            <button
              aria-label="Ver ficha"
              pButton
              class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
              pTooltip="Ver ficha"
              [routerLink]="[basePath() + '/alumnos/' + alumno().id]"
            >
              <app-icon name="eye" [size]="16" />
            </button>
            <button
              pButton
              class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
              pTooltip="Exportar Ficha PDF"
              aria-label="Exportar Ficha PDF"
              [disabled]="isGeneratingFicha() === alumno().enrollmentId"
              (click)="fichaExportClicked()"
              data-llm-action="export-student-card-pdf"
            >
              @if (isGeneratingFicha() === alumno().enrollmentId) {
                <app-icon name="loader-circle" [size]="16" class="animate-spin" />
              } @else {
                <app-icon name="download" [size]="16" />
              }
            </button>
            <button
              aria-label="Archivar alumno"
              pButton
              class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:bg-elevated hover:scale-110 active:scale-95 transition-all text-error"
              pTooltip="Archivar alumno"
              (click)="archivarRequested.emit(alumno().id)"
              data-llm-action="archive-student-card"
            >
              <app-icon name="trash-2" [size]="16" />
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class AlumnoCardComponent {
  readonly alumno = input.required<AlumnoTableRow>();
  readonly loading = input(false);
  readonly trashView = input(false);
  readonly basePath = input<string>('/app/secretaria');
  readonly isGeneratingFicha = input<number | false>(false);

  readonly restaurarRequested = output<string>();
  readonly archivarRequested = output<string>();
  readonly fichaExportRequested = output<number>();

  protected readonly fullName = computed(() => `${this.alumno().apellido} ${this.alumno().nombre}`);
  protected readonly initials = computed(
    () => `${this.alumno().nombre[0] ?? ''}${this.alumno().apellido[0] ?? ''}`,
  );
  protected readonly palette = computed(() => avatarPalette(this.fullName()));

  protected readonly statusBadgeVariant = computed(() =>
    getAlumnoStatusBadgeVariant(this.alumno().status),
  );

  protected readonly expedienteStatus = computed(() =>
    getExpedienteStatus(this.alumno().expediente),
  );
  protected readonly expedienteBadgeVariant = computed(() =>
    tagSeverityToBadgeVariant(this.expedienteStatus().severity),
  );
  protected readonly expedienteTooltip = computed(() => {
    const exp = this.alumno().expediente;
    return (
      'CI: ' +
      (exp.ci ? 'Sí' : 'No') +
      ' | Foto: ' +
      (exp.foto ? 'Sí' : 'No') +
      ' | Médico: ' +
      (exp.medico ? 'Sí' : 'No') +
      ' | SEMEP: ' +
      (exp.semep ? 'Sí' : 'No')
    );
  });

  protected fichaExportClicked(): void {
    const id = this.alumno().enrollmentId;
    if (id) this.fichaExportRequested.emit(id);
  }
}
