import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { AnnouncementsFacade } from '@core/facades/announcements.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

/**
 * Vista previa del correo (spec 0043-b, AC1/AC2).
 *
 * El HTML lo genera la Edge Function con el mismo wrapper que sale de verdad, así que lo
 * único que hace este componente es mostrarlo — y mostrarlo **aislado**.
 *
 * Va en un `<iframe>` con `srcdoc` y no inyectado en el DOM: el correo trae sus propias
 * reglas para `body`, `*` y varias clases genéricas (`.title`, `.message`, `.divider`), que
 * dentro de la app pisarían los estilos de la pantalla. El `sandbox` sin `allow-scripts`
 * además impide que un cuerpo con markup ejecute nada, aunque el servidor ya escape.
 */
@Component({
  selector: 'app-announcement-preview-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, DrawerFormComponent],
  template: `
    <app-drawer-form>
      <div class="flex flex-col gap-4">
        <div class="card p-3 flex items-start gap-2">
          <app-icon name="info" [size]="14" class="text-text-muted shrink-0" />
          <p class="text-xs text-text-secondary">
            Así lo va a recibir cada alumno. Las variables se muestran con datos de ejemplo; al
            enviar se reemplazan por los de cada destinatario.
          </p>
        </div>

        @if (facade.isLoadingPreviewHtml()) {
          <div class="card p-4 flex flex-col gap-3">
            <app-skeleton-block variant="rect" width="100%" height="90px" />
            <app-skeleton-block variant="text" width="70%" height="16px" />
            <app-skeleton-block variant="text" width="90%" height="13px" />
            <app-skeleton-block variant="text" width="85%" height="13px" />
          </div>
        } @else if (facade.previewHtml()) {
          <iframe
            #frame
            class="w-full rounded-xl border border-border-default bg-white"
            style="height: 520px"
            title="Vista previa del comunicado"
            sandbox=""
          ></iframe>
        } @else if (facade.error()) {
          <div class="flex items-center gap-2 rounded-lg px-3 py-2 bg-error-subtle">
            <app-icon name="alert-circle" [size]="14" color="var(--state-error)" />
            <span class="text-xs text-error">{{ facade.error() }}</span>
          </div>
        }
      </div>

      <ng-container ngProjectAs="[drawer-form-footer]">
        <button type="button" class="btn-secondary" (click)="drawer.back()">Volver a editar</button>
      </ng-container>
    </app-drawer-form>
  `,
})
export class AnnouncementPreviewDrawerComponent {
  protected readonly facade = inject(AnnouncementsFacade);
  protected readonly drawer = inject(LayoutDrawerFacadeService);

  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  constructor() {
    // `srcdoc` por binding no sirve: Angular lo sanea y descarta el `<style>` del correo,
    // que es justamente lo que hay que ver. Se asigna por propiedad, y el aislamiento lo
    // da el `sandbox` vacío del iframe, no el sanitizador.
    effect(() => {
      const html = this.facade.previewHtml();
      const el = this.frame()?.nativeElement;
      if (el && html) el.srcdoc = html;
    });
  }
}
