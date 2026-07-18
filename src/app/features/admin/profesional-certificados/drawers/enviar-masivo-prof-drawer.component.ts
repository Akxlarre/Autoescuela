import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { CertificacionProfesionalFacade } from '@core/facades/certificacion-profesional.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

/**
 * EnviarMasivoProfDrawerComponent — Smart / Drawer.
 * Confirma y dispara el envío masivo de certificados por correo.
 */
@Component({
  selector: 'app-enviar-masivo-prof-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerFormComponent, IconComponent, EmptyStateComponent],
  template: `
    <app-drawer-form>
      <div class="flex flex-col gap-4">
        <div class="flex items-start gap-3">
          <app-icon name="send" [size]="20" class="text-brand shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-text-primary m-0">
              {{ destinatarios().length }} alumno{{
                destinatarios().length !== 1 ? 's' : ''
              }}
              recibirá{{ destinatarios().length !== 1 ? 'n' : '' }} su certificado por correo
            </p>
            <p class="text-xs mt-1 text-text-muted m-0">
              Solo se incluyen alumnos con certificado generado que aún no han recibido el correo.
            </p>
          </div>
        </div>

        @if (destinatarios().length === 0) {
          <app-empty-state
            icon="mail-check"
            message="No hay envíos pendientes"
            subtitle="Todos los certificados generados ya fueron enviados por correo"
          />
        } @else {
          <div class="rounded-lg border divide-y overflow-hidden border-border-subtle">
            @for (alumno of destinatarios(); track alumno.enrollmentId) {
              <div class="flex items-center gap-3 px-4 py-2.5">
                <app-icon name="user" [size]="14" class="text-text-muted shrink-0" />
                <span class="text-sm font-medium flex-1 truncate text-text-primary">
                  {{ alumno.nombre }}
                </span>
                <span class="text-xs truncate text-brand">
                  {{ alumno.email }}
                </span>
              </div>
            }
          </div>
        }
      </div>

      <ng-container ngProjectAs="[drawer-form-footer]">
        <button
          class="btn-secondary"
          data-llm-action="cancel-bulk-email-professional"
          (click)="drawer.close()"
        >
          Cancelar
        </button>
        <button
          class="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          data-llm-action="confirm-bulk-email-professional"
          [disabled]="destinatarios().length === 0 || facade.sendingMasivo()"
          (click)="confirmar()"
        >
          @if (facade.sendingMasivo()) {
            <app-icon name="loader-circle" [size]="14" class="animate-spin" />
            Enviando...
          } @else {
            <app-icon name="send" [size]="14" />
            Enviar a {{ destinatarios().length }} alumno{{
              destinatarios().length !== 1 ? 's' : ''
            }}
          }
        </button>
      </ng-container>
    </app-drawer-form>
  `,
})
export class EnviarMasivoProfDrawerComponent {
  protected readonly facade = inject(CertificacionProfesionalFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);

  protected readonly destinatarios = computed(() =>
    this.facade
      .alumnos()
      .filter((a) => a.certificadoStatus === 'generado' && !a.emailEnviado && !!a.email),
  );

  protected async confirmar(): Promise<void> {
    await this.facade.enviarEmailsMasivo();
    this.drawer.close();
  }
}
