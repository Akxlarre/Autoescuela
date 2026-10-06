import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PromocionesFacade } from '@core/facades/promociones.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { PromocionDetalleContentComponent } from '@shared/components/promocion-detalle-content/promocion-detalle-content.component';
import { AdminPromocionEditarDrawerComponent } from './admin-promocion-editar-drawer.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

@Component({
  selector: 'app-admin-promocion-ver-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    SkeletonBlockComponent,
    PromocionDetalleContentComponent,
    DrawerContentLoaderComponent,
    DrawerFormComponent,
  ],
  template: `
    @if (promo(); as p) {
      <app-drawer-form>
        <app-drawer-content-loader>
          <ng-template #skeletons>
            <div class="flex flex-col gap-5">
              <!-- Header: título + badge, código + fechas -->
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-3">
                  <app-skeleton-block variant="text" width="45%" height="20px" />
                  <app-skeleton-block variant="text" width="70px" height="18px" />
                </div>
                <app-skeleton-block variant="text" width="55%" height="12px" />
              </div>

              <!-- Información general: grid de stat-boxes -->
              <div>
                <app-skeleton-block variant="text" width="35%" height="11px" />
                <div class="grid grid-cols-2 gap-3 mt-3">
                  @for (i of [1, 2, 3, 4]; track i) {
                    <app-skeleton-block variant="rect" width="100%" height="52px" />
                  }
                  <app-skeleton-block
                    variant="rect"
                    width="100%"
                    height="52px"
                    class="col-span-2"
                  />
                  <app-skeleton-block
                    variant="rect"
                    width="100%"
                    height="52px"
                    class="col-span-2"
                  />
                </div>
              </div>

              <!-- Cursos de la promoción: N cards con header + relatores + barra -->
              <div>
                <app-skeleton-block variant="text" width="40%" height="11px" />
                <div class="flex flex-col gap-3 mt-3">
                  @for (i of [1, 2]; track i) {
                    <div class="rounded-lg p-4 border border-border-subtle">
                      <div class="flex items-center gap-2 mb-3">
                        <app-skeleton-block variant="text" width="26px" height="18px" />
                        <app-skeleton-block variant="text" width="40%" height="14px" />
                      </div>
                      <div class="flex items-center gap-2 mb-2">
                        <app-skeleton-block variant="circle" width="28px" height="28px" />
                        <app-skeleton-block variant="text" width="45%" height="12px" />
                      </div>
                      <app-skeleton-block variant="text" width="100%" height="24px" />
                    </div>
                  }
                </div>
              </div>
            </div>
          </ng-template>
          <ng-template #content>
            <app-promocion-detalle-content
              [promo]="p"
              [studentsByCurso]="facade.cursoStudents()"
              [loadingStudents]="facade.isLoadingStudents()"
            />
          </ng-template>
        </app-drawer-content-loader>

        <ng-container ngProjectAs="[drawer-form-footer]">
          <button
            class="btn-primary flex items-center gap-2"
            (click)="editar()"
            data-llm-action="editar-promocion"
          >
            <app-icon name="edit" [size]="14" />
            Editar promoción
          </button>
        </ng-container>
      </app-drawer-form>
    }
  `,
})
export class AdminPromocionVerDrawerComponent {
  protected readonly facade = inject(PromocionesFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly promo = this.facade.selectedPromocion;

  protected editar(): void {
    this.layoutDrawer.push(AdminPromocionEditarDrawerComponent, 'Editar promoción', 'edit');
  }
}
