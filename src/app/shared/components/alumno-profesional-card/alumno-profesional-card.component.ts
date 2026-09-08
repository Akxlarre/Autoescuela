import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';

import { IconComponent } from '../icon/icon.component';
import { BadgeComponent } from '../badge/badge.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { avatarPalette } from '@core/utils/avatar-palette';
import { getAlumnoStatusBadgeVariant } from '@core/utils/alumno-status.utils';
import {
  moduloPct,
  getSemaforo,
  getSemaforoBadgeVariant,
} from '@core/utils/alumno-profesional-status.utils';
import type { AlumnoProfesionalTableRow } from '@core/models/ui/alumno-profesional-table-row.model';

/**
 * AlumnoProfesionalCard — card de alumno profesional para la vista comprimida/móvil.
 *
 * Hermana de `app-alumno-card` (fix-158-b): mismo lenguaje visual (`.card`,
 * `.micro-label`, avatar por `avatarPalette()`, `app-badge` unificado, header en dos
 * filas para que un badge de estado largo nunca compita por ancho con el nombre en los
 * anchos angostos del dual-viewport), pero cuerpo distinto — Base Alumnos Profesional
 * no tiene expediente de documentos, rastrea progreso de módulos + semáforo de
 * asistencia (fix-159-b).
 */
@Component({
  selector: 'app-alumno-profesional-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
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
        </div>
      </div>
    } @else {
      <div
        appCardHover
        class="card p-0 overflow-hidden flex flex-col"
        data-llm-description="Ficha resumen de un alumno profesional"
      >
        <!-- Header: avatar+nombre en su fila, estado en la suya (ver nota de fix-158-b) -->
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
                class="text-xs text-text-muted truncate font-mono"
                [pTooltip]="alumno().rut"
                tooltipPosition="top"
                >{{ alumno().rut }}</span
              >
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <app-badge [variant]="statusBadgeVariant()">{{ alumno().estado }}</app-badge>
          </div>
        </div>

        <!-- Body -->
        <div class="p-4 grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
          <div class="flex flex-col gap-1">
            <span class="micro-label">Promoción</span>
            <div class="flex items-center gap-1.5 flex-wrap">
              <app-badge variant="neutral">{{ alumno().promocion }}</app-badge>
              @if (alumno().convalidatedLicense) {
                <app-badge variant="info">Convalida {{ alumno().convalidatedLicense }}</app-badge>
              }
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <span class="micro-label">Asistencia</span>
            <div class="flex items-center w-fit">
              <app-badge [variant]="semaforoBadgeVariant()">{{ semaforo().label }}</app-badge>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <span class="micro-label">Progreso Módulos</span>
            <div class="flex items-center gap-2">
              <div class="w-14 h-1.5 rounded-full bg-elevated overflow-hidden">
                <div class="h-full bg-brand rounded-full" [style.width.%]="progressPct()"></div>
              </div>
              <span class="font-medium text-text-secondary font-mono text-xs"
                >{{ alumno().modulosAprobados }}/{{ alumno().modulosTotal }}</span
              >
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <span class="micro-label">Saldo</span>
            <span class="font-medium text-text-secondary text-xs">{{
              alumno().saldo | currency: 'CLP' : 'symbol' : '1.0-0'
            }}</span>
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
              data-llm-action="restore-professional-student-card"
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
              aria-label="Archivar alumno"
              pButton
              class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:bg-elevated hover:scale-110 active:scale-95 transition-all text-error"
              pTooltip="Archivar alumno"
              (click)="archivarRequested.emit(alumno().id)"
              data-llm-action="archive-professional-student-card"
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
export class AlumnoProfesionalCardComponent {
  readonly alumno = input.required<AlumnoProfesionalTableRow>();
  readonly loading = input(false);
  readonly trashView = input(false);
  readonly basePath = input<string>('/app/admin/clase-profesional');

  readonly restaurarRequested = output<string>();
  readonly archivarRequested = output<string>();

  protected readonly fullName = computed(() => `${this.alumno().apellido} ${this.alumno().nombre}`);
  protected readonly initials = computed(
    () => `${this.alumno().nombre[0] ?? ''}${this.alumno().apellido[0] ?? ''}`,
  );
  protected readonly palette = computed(() => avatarPalette(this.fullName()));

  protected readonly statusBadgeVariant = computed(() =>
    getAlumnoStatusBadgeVariant(this.alumno().estado),
  );

  protected readonly semaforo = computed(() => getSemaforo(this.alumno().semaforo));
  protected readonly semaforoBadgeVariant = computed(() =>
    getSemaforoBadgeVariant(this.alumno().semaforo),
  );
  protected readonly progressPct = computed(() =>
    moduloPct(this.alumno().modulosAprobados, this.alumno().modulosTotal),
  );
}
