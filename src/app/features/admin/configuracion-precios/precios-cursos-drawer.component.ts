import { Component, ChangeDetectionStrategy, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { CoursesFacade } from '@core/facades/courses.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

@Component({
  selector: 'app-precios-cursos-drawer',
  standalone: true,
  imports: [FormsModule, IconComponent, SkeletonBlockComponent, DrawerFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .field-input {
      width: 100%;
      padding: 9px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--input-bg);
      color: var(--text-primary);
      font-size: var(--text-sm);
      outline: none;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
    }
    .field-input--prefixed {
      padding-left: 28px;
    }
    .input-prefix-wrapper {
      position: relative;
    }
    .input-prefix {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-muted);
      pointer-events: none;
    }
  `,
  template: `
    <div class="flex h-full flex-col overflow-hidden">
      <!-- Header -->
      <div class="shrink-0 border-b border-border-subtle p-5 mb-4">
        <h2 class="text-lg font-bold text-text-primary">Precios de Cursos</h2>
        <p class="mt-1 text-sm text-text-muted">
          Edita el precio base de los cursos existentes. No crea ni elimina cursos.
        </p>
      </div>

      <app-drawer-form>
        <div class="space-y-4">
          <div>
            <label class="text-xs font-semibold text-text-muted mb-1 block">Sede</label>
            <select
              class="field-input cursor-pointer"
              [(ngModel)]="localBranchId"
              data-llm-description="select for which branch's courses to edit prices for"
            >
              @for (branch of branchFacade.branches(); track branch.id) {
                <option [ngValue]="branch.id">{{ branch.name }}</option>
              }
            </select>
          </div>

          @if (coursesFacade.isLoading()) {
            <app-skeleton-block variant="rect" width="100%" height="56px" />
            <app-skeleton-block variant="rect" width="100%" height="56px" />
            <app-skeleton-block variant="rect" width="100%" height="56px" />
          } @else if (coursesFacade.availableCourses().length === 0) {
            <div
              class="text-center py-8 border border-dashed border-border-default rounded-xl bg-base"
            >
              <app-icon
                name="book-open"
                [size]="24"
                class="text-text-muted mx-auto mb-2 opacity-50"
              />
              <p class="text-sm text-text-muted">Esta sede no tiene cursos activos.</p>
            </div>
          } @else {
            <div class="space-y-2">
              @for (course of coursesFacade.availableCourses(); track course.id) {
                <div
                  class="p-3.5 rounded-xl border border-border-default bg-base flex items-center gap-3"
                >
                  <div class="flex-1 min-w-0">
                    <p class="item-title truncate">{{ course.name }}</p>
                    <p class="text-xs text-text-muted">{{ course.license_class }}</p>
                  </div>
                  <div class="input-prefix-wrapper w-36">
                    <span class="input-prefix">$</span>
                    <input
                      type="number"
                      class="field-input field-input--prefixed"
                      [ngModel]="draftPrice(course.id, course.base_price)"
                      (ngModelChange)="setDraftPrice(course.id, $event)"
                      min="0"
                      data-llm-description="input for the course base price"
                    />
                  </div>
                  <button
                    type="button"
                    class="btn-primary py-1.5 px-3 text-xs shrink-0 flex items-center gap-1.5"
                    [disabled]="!isDirty(course.id, course.base_price) || savingCourseId() !== null"
                    (click)="savePrice(course.id)"
                    [attr.aria-label]="'Guardar precio de ' + course.name"
                    data-llm-action="guardar-precio-curso"
                  >
                    @if (savingCourseId() === course.id) {
                      <app-icon name="loader-circle" [size]="12" class="animate-spin" />
                      <span>Guardando...</span>
                    } @else {
                      <app-icon name="save" [size]="12" />
                      <span>Guardar</span>
                    }
                  </button>
                </div>
              }
            </div>
          }
        </div>

        <!-- Footer -->
        <ng-container ngProjectAs="[drawer-form-footer]">
          <button type="button" class="btn-secondary" (click)="close()">Cerrar</button>
        </ng-container>
      </app-drawer-form>
    </div>
  `,
})
export class PreciosCursosDrawerComponent {
  protected readonly coursesFacade = inject(CoursesFacade);
  protected readonly branchFacade = inject(BranchFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly localBranchId = signal<number>(
    this.branchFacade.selectedBranchId() ?? this.branchFacade.branches()[0]?.id ?? 0,
  );

  /** `null` = el campo está vacío (usuario borrando para escribir un valor nuevo). */
  private readonly drafts = signal<Record<number, number | null>>({});
  protected readonly savingCourseId = signal<number | null>(null);

  constructor() {
    effect(() => {
      const branchId = this.localBranchId();
      if (branchId) {
        this.drafts.set({});
        void this.coursesFacade.loadAvailableCourses(branchId);
      }
    });
  }

  protected draftPrice(courseId: number, originalPrice: number | null | undefined): number | null {
    const drafts = this.drafts();
    return courseId in drafts ? drafts[courseId] : (originalPrice ?? 0);
  }

  protected setDraftPrice(courseId: number, value: number | null): void {
    this.drafts.update((d) => ({ ...d, [courseId]: value }));
  }

  protected isDirty(courseId: number, originalPrice: number | null | undefined): boolean {
    const drafts = this.drafts();
    if (!(courseId in drafts)) return false;
    return drafts[courseId] !== (originalPrice ?? 0);
  }

  protected async savePrice(courseId: number): Promise<void> {
    const drafts = this.drafts();
    if (!(courseId in drafts)) return;
    const price = drafts[courseId];
    if (price === null) return;

    this.savingCourseId.set(courseId);
    const success = await this.coursesFacade.updateBasePrice(courseId, price);
    this.savingCourseId.set(null);

    if (success) {
      this.drafts.update((d) => {
        const next = { ...d };
        delete next[courseId];
        return next;
      });
    }
  }

  protected close(): void {
    this.layoutDrawer.back();
  }
}
