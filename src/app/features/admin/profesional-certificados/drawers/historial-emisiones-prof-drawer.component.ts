import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { CertificacionProfesionalFacade } from '@core/facades/certificacion-profesional.facade';
import { ACCION_LABELS_PROF } from '@core/models/ui/certificacion-profesional.model';

/**
 * HistorialEmisionesProfDrawerComponent — Smart / Drawer de solo lectura.
 * Lee `CertificacionProfesionalFacade.log()` — sin inputs (LayoutDrawer no los soporta).
 */
@Component({
  selector: 'app-historial-emisiones-prof-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DrawerFormComponent,
    SkeletonBlockComponent,
    IconComponent,
    BadgeComponent,
    EmptyStateComponent,
  ],
  template: `
    <app-drawer-form [hasFooter]="false">
      <div class="flex flex-col gap-4">
        <p class="text-sm text-text-secondary m-0">
          {{ facade.log().length }} registro{{ facade.log().length !== 1 ? 's' : '' }} de emisión de
          certificados Clase Profesional.
        </p>

        @if (facade.isLoading()) {
          <div class="flex flex-col gap-3">
            @for (_ of skeletonRows; track $index) {
              <div class="flex items-start gap-3 py-2">
                <app-skeleton-block variant="circle" width="28px" height="28px" class="shrink-0" />
                <div class="flex-1 min-w-0 flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="60%" height="13px" />
                  <app-skeleton-block variant="text" width="35%" height="11px" />
                </div>
              </div>
            }
          </div>
        } @else if (facade.log().length === 0) {
          <app-empty-state
            icon="scroll"
            message="No hay registros de emisión aún"
            subtitle="Aquí aparecerán los certificados generados, descargados y enviados por correo"
          />
        } @else {
          <ul class="m-0 p-0 list-none flex flex-col">
            @for (entry of pagedLog(); track entry.id) {
              <li class="flex items-start gap-3 py-3 border-b last:border-b-0 border-border-subtle">
                <app-icon
                  [name]="getAccionIcon(entry.accion)"
                  [size]="16"
                  class="mt-0.5 shrink-0 text-text-muted"
                />
                <div class="flex-1 min-w-0 flex flex-col gap-1">
                  <div class="flex items-center justify-between gap-2">
                    <app-badge [variant]="getAccionVariant(entry.accion)">
                      {{ getAccionLabel(entry.accion) }}
                    </app-badge>
                    <span class="text-xs font-mono text-text-muted shrink-0">
                      {{ entry.fecha | date: 'dd/MM/yyyy HH:mm' }}
                    </span>
                  </div>
                  <p class="m-0 text-sm font-medium text-text-primary truncate">
                    {{ entry.alumnoNombre }}
                  </p>
                  <p class="m-0 text-xs text-text-muted">Por {{ entry.usuarioNombre }}</p>
                </div>
              </li>
            }
          </ul>

          @if (totalPages() > 1) {
            <div class="flex items-center justify-between pt-1">
              <span class="text-xs text-text-muted">
                {{ currentPage() * PAGE_SIZE + 1 }}–{{ pageEnd() }} de {{ facade.log().length }}
              </span>
              <div class="flex items-center gap-1">
                <button
                  class="p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary"
                  [disabled]="currentPage() === 0"
                  (click)="prevPage()"
                >
                  <app-icon name="chevron-left" [size]="16" />
                </button>
                <span class="text-xs px-2 text-text-secondary">
                  Pág. {{ currentPage() + 1 }} / {{ totalPages() }}
                </span>
                <button
                  class="p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary"
                  [disabled]="currentPage() >= totalPages() - 1"
                  (click)="nextPage()"
                >
                  <app-icon name="chevron-right" [size]="16" />
                </button>
              </div>
            </div>
          }
        }
      </div>
    </app-drawer-form>
  `,
})
export class HistorialEmisionesProfDrawerComponent {
  protected readonly facade = inject(CertificacionProfesionalFacade);

  protected readonly skeletonRows = Array.from({ length: 6 });

  protected readonly PAGE_SIZE = 10;
  protected readonly currentPage = signal(0);

  protected readonly totalPages = computed(() =>
    Math.ceil(this.facade.log().length / this.PAGE_SIZE),
  );

  protected readonly pagedLog = computed(() => {
    const page = this.currentPage();
    const start = page * this.PAGE_SIZE;
    return this.facade.log().slice(start, start + this.PAGE_SIZE);
  });

  protected pageEnd(): number {
    return Math.min((this.currentPage() + 1) * this.PAGE_SIZE, this.facade.log().length);
  }

  protected prevPage(): void {
    this.currentPage.update((p) => Math.max(0, p - 1));
  }

  protected nextPage(): void {
    this.currentPage.update((p) => Math.min(this.totalPages() - 1, p + 1));
  }

  protected getAccionLabel(accion: string): string {
    return ACCION_LABELS_PROF[accion] ?? accion;
  }

  protected getAccionVariant(accion: string): 'success' | 'brand' | 'info' | 'neutral' {
    switch (accion) {
      case 'generated':
        return 'success';
      case 'email_sent':
        return 'brand';
      case 'downloaded':
        return 'info';
      default:
        return 'neutral';
    }
  }

  protected getAccionIcon(accion: string): string {
    switch (accion) {
      case 'generated':
        return 'file-check';
      case 'email_sent':
        return 'send';
      case 'downloaded':
        return 'download';
      default:
        return 'circle';
    }
  }
}
