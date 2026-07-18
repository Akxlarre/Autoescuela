import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { CertificacionProfesionalFacade } from '@core/facades/certificacion-profesional.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

/**
 * GenerarPendientesProfDrawerComponent — Smart / Drawer.
 * Confirma y dispara la generación en lote de certificados pendientes elegibles.
 */
@Component({
  selector: 'app-generar-pendientes-prof-drawer',
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
              {{ pendientesElegibles().length }} de {{ pendientesCount() }} alumno{{
                pendientesCount() !== 1 ? 's' : ''
              }}
              {{ pendientesElegibles().length !== 1 ? 'serán certificados' : 'será certificado' }}
            </p>
            @if (pendientesNoElegibles().length > 0) {
              <p class="text-xs mt-1 text-text-muted m-0">
                {{ pendientesNoElegibles().length }} alumno{{
                  pendientesNoElegibles().length !== 1 ? 's no cumplen' : ' no cumple'
                }}
                los requisitos y no recibirán certificado.
              </p>
            }
          </div>
        </div>

        @if (pendientesCount() === 0) {
          <app-empty-state
            icon="check-circle"
            message="No quedan certificados pendientes"
            subtitle="Todos los alumnos elegibles ya tienen su certificado generado"
          />
        } @else {
          @if (pendientesElegibles().length > 0) {
            <div class="rounded-lg border divide-y overflow-hidden border-border-subtle">
              @for (alumno of pendientesElegibles(); track alumno.enrollmentId) {
                <div class="flex items-center gap-3 px-4 py-2.5">
                  <app-icon name="file-check" [size]="14" class="text-success shrink-0" />
                  <span class="text-sm font-medium flex-1 truncate text-text-primary">
                    {{ alumno.nombre }}
                  </span>
                  @if (
                    alumno.pctAsistenciaPractica !== null && alumno.pctAsistenciaPractica < 100
                  ) {
                    <span class="text-xs text-warning shrink-0">
                      <app-icon name="alert-triangle" [size]="11" />
                      {{ alumno.pctAsistenciaPractica }}% práctica
                    </span>
                  }
                </div>
              }
            </div>
          }

          @if (pendientesNoElegibles().length > 0) {
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider mb-2 text-text-muted">
                No elegibles — no se generará certificado
              </p>
              <div class="rounded-lg border divide-y overflow-hidden border-border-subtle">
                @for (alumno of pendientesNoElegibles(); track alumno.enrollmentId) {
                  <div class="flex items-center gap-3 px-4 py-2.5">
                    <app-icon name="x-circle" [size]="14" class="text-warning shrink-0" />
                    <span class="text-sm flex-1 truncate text-text-muted">
                      {{ alumno.nombre }}
                    </span>
                    <span class="text-xs text-text-muted shrink-0">
                      @if (!alumno.elegibilidad.teoria) {
                        Teoría &lt;75% ·
                      }
                      @if (!alumno.elegibilidad.nota) {
                        Nota &lt;75 ·
                      }
                      @if (!alumno.elegibilidad.pago) {
                        Pago pendiente
                      }
                    </span>
                  </div>
                }
              </div>
            </div>
          }
        }
      </div>

      <ng-container ngProjectAs="[drawer-form-footer]">
        <button
          class="btn-secondary"
          data-llm-action="cancel-generate-pending-professional-certificates"
          (click)="drawer.close()"
        >
          Cancelar
        </button>
        <button
          class="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          data-llm-action="confirm-generate-pending-professional-certificates"
          [disabled]="pendientesElegibles().length === 0 || facade.isGeneratingPendientes()"
          (click)="confirmar()"
        >
          @if (facade.isGeneratingPendientes()) {
            <app-icon name="loader-circle" [size]="14" class="animate-spin" />
            Generando...
          } @else {
            <app-icon name="file-check" [size]="14" />
            Generar {{ pendientesElegibles().length }} certificado{{
              pendientesElegibles().length !== 1 ? 's' : ''
            }}
          }
        </button>
      </ng-container>
    </app-drawer-form>
  `,
})
export class GenerarPendientesProfDrawerComponent {
  protected readonly facade = inject(CertificacionProfesionalFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);

  protected readonly pendientesCount = computed(
    () => this.facade.alumnos().filter((a) => a.certificadoStatus === 'pendiente').length,
  );

  protected readonly pendientesElegibles = computed(() =>
    this.facade.alumnos().filter((a) => a.certificadoStatus === 'pendiente' && a.elegible),
  );

  protected readonly pendientesNoElegibles = computed(() =>
    this.facade.alumnos().filter((a) => a.certificadoStatus === 'pendiente' && !a.elegible),
  );

  protected async confirmar(): Promise<void> {
    await this.facade.generarPendientes();
    this.drawer.close();
  }
}
