import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { BranchOption, BranchCoursePrice } from '@core/models/ui/branch.model';
import type { PublicFlowType } from '@core/facades/public-enrollment.facade';

interface BranchCardMeta {
  branch: BranchOption;
  description: string;
  address: string;
  courses: BranchCoursePrice[];
  icon: string;
}

@Component({
  selector: 'app-branch-course-selector',
  imports: [IconComponent, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <!-- Branch Selection -->
      <div>
        <h2 class="text-lg font-semibold text-primary mb-2">Elige tu sede</h2>
        <p class="text-sm text-secondary mb-6">
          Selecciona la escuela de conductores donde deseas matricularte.
        </p>
        <div class="grid sm:grid-cols-2 gap-4">
          @for (card of branchCards(); track card.branch.id) {
            <button
              type="button"
              class="group relative flex flex-col p-6 rounded-xl border-2 text-left transition-all cursor-pointer
                     hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              [class.border-[var(--ds-brand)]]="selectedBranchId() === card.branch.id"
              [class.bg-brand-muted]="selectedBranchId() === card.branch.id"
              [class.shadow-sm]="selectedBranchId() === card.branch.id"
              [class.border-border]="selectedBranchId() !== card.branch.id"
              [class.bg-surface]="selectedBranchId() !== card.branch.id"
              data-llm-action="select-branch"
              (click)="onBranchSelect(card.branch)"
            >
              <div class="flex items-center gap-3 mb-3">
                <div
                  class="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                  [class.bg-brand-muted]="selectedBranchId() !== card.branch.id"
                  [style.background]="
                    selectedBranchId() === card.branch.id
                      ? 'color-mix(in srgb, var(--ds-brand) 20%, transparent)'
                      : ''
                  "
                >
                  <app-icon [name]="card.icon" [size]="22" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-base font-bold" style="color: var(--text-primary)">
                    {{ card.branch.name }}
                  </p>
                  <p class="text-xs text-muted">{{ card.address }}</p>
                </div>
                @if (selectedBranchId() === card.branch.id) {
                  <div
                    class="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    [style.background]="'var(--ds-brand)'"
                  >
                    <app-icon name="check" [size]="14" color="white" />
                  </div>
                }
              </div>
              <p class="text-xs text-secondary mb-3">{{ card.description }}</p>
              <div class="flex flex-wrap gap-1.5">
                @for (course of card.courses; track course.name) {
                  <span
                    class="text-xs px-2.5 py-1 rounded-full font-medium border border-border inline-flex items-center gap-1"
                    style="background: var(--bg-surface-elevated); color: var(--text-primary)"
                  >
                    {{ course.name }}
                    @if (course.price > 0) {
                      <span class="text-muted">·</span>
                      <span style="color: var(--ds-brand)">{{
                        course.price | currency: 'CLP' : 'symbol-narrow' : '1.0-0'
                      }}</span>
                    }
                  </span>
                }
              </div>
            </button>
          }
        </div>
      </div>

      <!-- Flow Type Selection (only visible when branch is selected) -->
      @if (selectedBranchId() !== null && availableFlows().length > 1) {
        <div>
          <h2 class="text-lg font-semibold text-primary mb-2">Tipo de licencia</h2>
          <p class="text-sm text-secondary mb-4">
            Selecciona el tipo de curso al que deseas inscribirte.
          </p>
          <div class="grid sm:grid-cols-2 gap-4">
            @for (flow of availableFlows(); track flow.value) {
              <button
                type="button"
                class="group relative flex flex-col p-5 rounded-xl border-2 text-left transition-all cursor-pointer
                       hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                [class.border-[var(--ds-brand)]]="selectedFlow() === flow.value"
                [class.bg-brand-muted]="selectedFlow() === flow.value"
                [class.shadow-sm]="selectedFlow() === flow.value"
                [class.border-border]="selectedFlow() !== flow.value"
                [class.bg-surface]="selectedFlow() !== flow.value"
                data-llm-action="select-flow-type"
                (click)="onFlowSelect(flow.value)"
              >
                <div class="flex items-center gap-3 mb-2">
                  <app-icon [name]="flow.icon" [size]="20" />
                  <p class="text-base font-bold" style="color: var(--text-primary)">
                    {{ flow.label }}
                  </p>
                </div>
                <p class="text-xs text-secondary">{{ flow.description }}</p>
                @if (flow.value === 'professional') {
                  <div class="mt-3 p-2.5 rounded-lg bg-surface-elevated border border-border">
                    <p class="text-xs text-muted flex items-center gap-1.5">
                      <app-icon name="info" [size]="14" />
                      Solo pre-inscripción. La matrícula completa se realiza presencialmente.
                    </p>
                  </div>
                }
              </button>
            }
          </div>
        </div>
      }

      <!-- Continue Button -->
      @if (canContinue()) {
        <div class="flex justify-end pt-2">
          <button
            type="button"
            class="btn-primary px-6 py-2.5 rounded-lg font-medium text-sm cursor-pointer"
            data-llm-action="confirm-branch-selection"
            (click)="onContinue()"
          >
            Continuar
          </button>
        </div>
      }
    </div>
  `,
})
export class BranchCourseSelectorComponent {
  branches = input.required<BranchOption[]>();
  coursePricing = input<Map<number, BranchCoursePrice[]>>(new Map());
  branchSelect = output<BranchOption>();
  flowSelect = output<PublicFlowType>();
  confirm = output<void>();

  readonly selectedBranchId = signal<number | null>(null);
  readonly selectedFlow = signal<PublicFlowType | null>(null);

  readonly branchCards = computed<BranchCardMeta[]>(() => {
    const pricing = this.coursePricing();
    return this.branches().map((b) => {
      const courses = pricing.get(b.id) ?? [];
      const hasProfessional = courses.some((c) => c.licenseClass !== 'B');
      return {
        branch: b,
        description: hasProfessional
          ? 'Escuela de conductores profesionales y no profesionales'
          : 'Escuela de conductores no profesionales',
        address: b.address ?? 'Chillán',
        courses,
        icon: hasProfessional ? 'truck' : 'car',
      };
    });
  });

  readonly availableFlows = computed(() => {
    const branchId = this.selectedBranchId();
    if (branchId === null) return [];

    const courses = this.coursePricing().get(branchId) ?? [];
    const hasProfessional = courses.some((c) => c.licenseClass !== 'B');

    const flows: { value: PublicFlowType; label: string; description: string; icon: string }[] = [
      {
        value: 'class_b',
        label: 'Clase B',
        description: 'Licencia para vehículos particulares. Proceso completo online.',
        icon: 'car',
      },
    ];

    if (hasProfessional) {
      flows.push({
        value: 'professional',
        label: 'Clase Profesional',
        description: 'Licencias A2, A3, A4, A5. Pre-inscripción online.',
        icon: 'truck',
      });
    }

    return flows;
  });

  readonly canContinue = computed(() => {
    const branchId = this.selectedBranchId();
    if (branchId === null) return false;

    const flows = this.availableFlows();
    // Si solo hay un flujo disponible, auto-seleccionarlo
    if (flows.length === 1) return true;
    return this.selectedFlow() !== null;
  });

  onBranchSelect(branch: BranchOption): void {
    this.selectedBranchId.set(branch.id);
    this.selectedFlow.set(null);
    this.branchSelect.emit(branch);

    // Auto-seleccionar flujo si solo hay uno
    const flows = this.availableFlows();
    if (flows.length === 1) {
      this.selectedFlow.set(flows[0].value);
      this.flowSelect.emit(flows[0].value);
    }
  }

  onFlowSelect(flow: PublicFlowType): void {
    this.selectedFlow.set(flow);
    this.flowSelect.emit(flow);
  }

  onContinue(): void {
    const flow = this.selectedFlow();
    if (flow) {
      this.confirm.emit();
    }
  }
}
