import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';

import { IconComponent } from '../icon/icon.component';
import { BadgeComponent } from '../badge/badge.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { avatarPalette } from '@core/utils/avatar-palette';
import { getEgresadoAccountStatus } from '@core/utils/egresado-status.utils';
import { getInitialsFromDisplayName } from '@core/models/ui/user.model';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';

/**
 * EgresadoCard — card de egresado para la vista comprimida/móvil de Ex-Alumnos.
 *
 * Compartida por Ex-Alumnos B y Ex-Alumnos Profesional (ambos consumen
 * `EgresadoTableRow`) — hermana visual de `app-alumno-card`/`app-alumno-profesional-card`
 * (fix-158-b/fix-159-b): `.card`, `.micro-label`, avatar por `avatarPalette()`,
 * `app-badge` unificado (reemplaza el `.inas-badge` CSS ad-hoc de Ex-Alumnos B y el
 * `p-tag` de Ex-Alumnos Profesional), header en dos filas.
 *
 * `nroLabel` y `viewQueryParams` existen porque los dos consumidores difieren en detalles
 * reales (copy "Nº Exp." vs "Nº Mat.", y Profesional pasa `?from=ex-alumnos` al navegar a
 * la ficha) — no se fusionan, se parametrizan.
 */
@Component({
  selector: 'app-egresado-card',
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
        </div>
      </div>
    } @else {
      <div
        appCardHover
        class="card p-0 overflow-hidden flex flex-col"
        data-llm-description="Ficha resumen de un egresado"
      >
        <!-- Header: avatar+nombre en su fila, licencia(s) en la suya -->
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
              <span
                class="item-title truncate"
                [pTooltip]="egresado().nombre"
                tooltipPosition="top"
                >{{ egresado().nombre }}</span
              >
              <span
                class="text-xs text-text-muted truncate"
                [pTooltip]="egresado().correo"
                tooltipPosition="top"
                >{{ egresado().correo }}</span
              >
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <app-badge [variant]="licenciaBadgeVariant()">{{ egresado().licencia }}</app-badge>
            @if (egresado().convalidatedLicense) {
              <app-badge variant="info">Convalida {{ egresado().convalidatedLicense }}</app-badge>
            }
          </div>
        </div>

        <!-- Body -->
        <div class="p-4 grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
          <div class="flex flex-col gap-1">
            <span class="micro-label">RUT</span>
            <span class="font-medium text-text-secondary font-mono text-xs">{{
              egresado().rut
            }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="micro-label">{{ nroLabel() }}</span>
            <span class="font-medium text-text-secondary font-mono text-xs">{{
              egresado().nroExpediente ?? '—'
            }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="micro-label">Año / Sede</span>
            <span class="font-medium text-text-secondary text-xs"
              >{{ egresado().anio ?? '—' }} · {{ egresado().sede }}</span
            >
          </div>
          <div class="flex flex-col gap-1">
            <span class="micro-label">Estado cuenta</span>
            <div class="flex items-center w-fit">
              <app-badge [variant]="accountStatus().variant">{{ accountStatus().label }}</app-badge>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div
          class="p-2 bg-transparent border-t border-border-subtle flex items-center justify-end gap-0.5 mt-auto"
        >
          <button
            aria-label="Ver ficha"
            pButton
            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
            pTooltip="Ver ficha"
            [routerLink]="[basePath() + '/alumnos', egresado().studentId]"
            [queryParams]="viewQueryParams()"
            data-llm-action="view-student-detail-card"
          >
            <app-icon name="eye" [size]="16" />
          </button>
          <button
            aria-label="Re-matricular"
            pButton
            class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
            pTooltip="Re-matricular"
            (click)="reEnrollRequested.emit(egresado())"
            data-llm-action="re-enroll-student-card"
          >
            <app-icon name="user-plus" [size]="16" />
          </button>
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
export class EgresadoCardComponent {
  readonly egresado = input.required<EgresadoTableRow>();
  readonly loading = input(false);
  readonly basePath = input<string>('/app/admin');
  /** 'Nº Exp.' (Ex-Alumnos B) vs 'Nº Mat.' (Ex-Alumnos Profesional) — mismo campo, copy distinto. */
  readonly nroLabel = input<string>('Nº Exp.');
  /** Ex-Alumnos Profesional pasa { from: 'ex-alumnos' } al navegar a la ficha; B no pasa nada. */
  readonly viewQueryParams = input<Record<string, string>>({});

  readonly reEnrollRequested = output<EgresadoTableRow>();

  protected readonly initials = computed(() => getInitialsFromDisplayName(this.egresado().nombre));
  protected readonly palette = computed(() => avatarPalette(this.egresado().nombre));

  protected readonly accountStatus = computed(() =>
    getEgresadoAccountStatus(this.egresado().saldoPendiente),
  );

  /** Brand tint para licencias Clase B (mismo criterio que curso.licenseGroup en app-alumno-card). */
  protected readonly licenciaBadgeVariant = computed(() =>
    this.egresado().licenseGroup === 'class_b' ? 'brand' : 'neutral',
  );
}
