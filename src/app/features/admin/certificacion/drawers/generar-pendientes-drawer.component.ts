import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { CertificacionClaseBFacade } from '@core/facades/certificacion-clase-b.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

/**
 * GenerarPendientesDrawerComponent — Smart / Drawer.
 * Confirma y dispara la generación en lote de certificados pendientes.
 */
@Component({
  selector: 'app-generar-pendientes-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerFormComponent, IconComponent, EmptyStateComponent],
  template: `
    <app-drawer-form>
      <div class="flex flex-col gap-4">
        <div class="flex items-start gap-3">
          <app-icon name="file-check" [size]="20" class="text-brand shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-text-primary m-0">
              {{ pendientes().length }} certificado{{ pendientes().length !== 1 ? 's' : '' }} por
              generar
            </p>
            <p class="text-xs mt-1 text-text-muted m-0">
              Se generará el certificado de todos los alumnos pendientes elegibles.
            </p>
          </div>
        </div>

        @if (pendientes().length === 0) {
          <app-empty-state
            icon="check-circle"
            message="No quedan certificados pendientes"
            subtitle="Todos los alumnos elegibles ya tienen su certificado generado"
          />
        } @else {
          <div class="rounded-lg border divide-y overflow-hidden border-border-subtle">
            @for (alumno of pendientes(); track alumno.enrollmentId) {
              <div class="flex items-center gap-3 px-4 py-2.5">
                <app-icon name="file-check" [size]="14" class="text-success shrink-0" />
                <span class="text-sm font-medium flex-1 truncate text-text-primary">
                  {{ alumno.nombre }}
                </span>
              </div>
            }
          </div>
        }
      </div>

      <ng-container ngProjectAs="[drawer-form-footer]">
        <button
          class="btn-secondary"
          data-llm-action="cancel-generate-pending-certificates"
          (click)="drawer.close()"
        >
          Cancelar
        </button>
        <button
          class="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          data-llm-action="confirm-generate-pending-certificates"
          [disabled]="pendientes().length === 0 || facade.isGeneratingPendientes()"
          (click)="confirmar()"
        >
          @if (facade.isGeneratingPendientes()) {
            <app-icon name="loader-circle" [size]="14" class="animate-spin" />
            Generando...
          } @else {
            <app-icon name="file-check" [size]="14" />
            Generar {{ pendientes().length }} certificado{{ pendientes().length !== 1 ? 's' : '' }}
          }
        </button>
      </ng-container>
    </app-drawer-form>
  `,
})
export class GenerarPendientesDrawerComponent {
  protected readonly facade = inject(CertificacionClaseBFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);

  protected readonly pendientes = computed(() =>
    this.facade.alumnos().filter((a) => a.certificadoStatus === 'pendiente'),
  );

  protected async confirmar(): Promise<void> {
    await this.facade.generarPendientes();
    this.drawer.close();
  }
}
