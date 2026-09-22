import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { ClassBTopicsFacade } from '@core/facades/class-b-topics.facade';

/**
 * Malla de temas de las 12 clases prácticas Clase B (ASG-m-007, fix-169-b). Solo admin.
 *
 * Vive como drawer dentro de Ajustes y no como página con ítem de menú propio: es
 * configuración institucional de admin, igual que precios, tarifas, descuentos y
 * plantillas de comunicado, que ya viven ahí. `fix-167-b` ya corrigió este mismo desvío
 * cuando la privacidad del alumno se había hecho como página standalone.
 *
 * El gate visual (`isAdmin()` en Ajustes) es por comodidad; quien impide de verdad que
 * otro rol escriba es la policy de UPDATE de `class_b_topics`.
 */
@Component({
  selector: 'app-class-b-topics-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, SkeletonBlockComponent, DrawerFormComponent],
  template: `
    <app-drawer-form>
      <div class="flex flex-col gap-4" data-llm-form="manage-class-b-topics">
        <div class="card p-3 flex items-start gap-2">
          <app-icon name="info" [size]="14" class="text-text-muted shrink-0" />
          <p class="text-xs text-text-secondary">
            El tema es fijo por número de clase. Se muestra en la ficha técnica del alumno y en el
            portal del instructor.
          </p>
        </div>

        @if (facade.error(); as err) {
          <div class="flex items-center gap-2 rounded-lg px-3 py-2 bg-error-subtle">
            <app-icon name="alert-circle" [size]="14" color="var(--state-error)" />
            <span class="text-xs text-error">{{ err }}</span>
          </div>
        }

        @if (facade.isLoading() && facade.topics().length === 0) {
          <div class="flex flex-col gap-2">
            @for (i of filasSkeleton; track i) {
              <app-skeleton-block variant="rect" width="100%" height="44px" />
            }
          </div>
        } @else {
          <ul class="card p-0 overflow-hidden divide-y divide-border-subtle">
            @for (item of facade.topics(); track item.class_number) {
              <li class="flex items-center gap-3 px-3 py-2">
                <span class="micro-label shrink-0 w-16">Clase {{ item.class_number }}</span>

                @if (editando() === item.class_number) {
                  <input
                    type="text"
                    class="field-input flex-1"
                    [attr.aria-label]="'Tema de la clase ' + item.class_number"
                    [ngModel]="valor()"
                    (ngModelChange)="valor.set($event)"
                    (keyup.enter)="guardar(item.class_number)"
                    (keyup.escape)="cancelar()"
                  />
                  <button
                    type="button"
                    class="shrink-0 cursor-pointer rounded-lg p-1.5 text-success transition-colors hover:bg-subtle"
                    [attr.data-llm-action]="'save-class-b-topic-' + item.class_number"
                    [disabled]="guardando()"
                    (click)="guardar(item.class_number)"
                    title="Guardar"
                  >
                    <app-icon [name]="guardando() ? 'loader-circle' : 'check'" [size]="16" />
                  </button>
                  <button
                    type="button"
                    class="shrink-0 cursor-pointer rounded-lg p-1.5 text-text-muted transition-colors hover:bg-subtle"
                    (click)="cancelar()"
                    title="Cancelar"
                  >
                    <app-icon name="x" [size]="16" />
                  </button>
                } @else {
                  <span class="flex-1 text-xs text-text-secondary">{{ item.topic }}</span>
                  <button
                    type="button"
                    class="shrink-0 cursor-pointer rounded-lg p-1.5 text-text-muted transition-colors hover:bg-subtle hover:text-brand"
                    [attr.data-llm-action]="'edit-class-b-topic-' + item.class_number"
                    (click)="editar(item.class_number, item.topic)"
                    title="Editar"
                  >
                    <app-icon name="pencil" [size]="16" />
                  </button>
                }
              </li>
            }
          </ul>
        }
      </div>
    </app-drawer-form>
  `,
})
export class ClassBTopicsDrawerComponent implements OnInit {
  protected readonly facade = inject(ClassBTopicsFacade);

  protected readonly editando = signal<number | null>(null);
  protected readonly valor = signal('');
  protected readonly guardando = signal(false);
  protected readonly filasSkeleton = [0, 1, 2, 3, 4, 5];

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected editar(classNumber: number, topic: string): void {
    this.editando.set(classNumber);
    this.valor.set(topic);
  }

  protected cancelar(): void {
    this.editando.set(null);
    this.valor.set('');
  }

  protected async guardar(classNumber: number): Promise<void> {
    if (this.guardando()) return;

    this.guardando.set(true);
    try {
      // Solo se sale del modo edición si guardó: si falló, el texto tipeado no se pierde
      // y el motivo queda visible arriba.
      const ok = await this.facade.updateTopic(classNumber, this.valor());
      if (ok) this.cancelar();
    } finally {
      this.guardando.set(false);
    }
  }
}
