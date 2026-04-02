import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { EvaluationChecklistItem } from '@core/models/ui/instructor-portal.model';

@Component({
  selector: 'app-evaluation-checklist',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .checklist-item-text {
      color: var(--text-primary) !important;
      font-weight: 700;
    }
    .text-checked {
      color: var(--ds-brand) !important;
    }
  `],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-xs sm:text-sm font-bold text-primary uppercase tracking-widest flex items-center gap-2">
          <app-icon name="list-checks" [size]="16" class="text-brand"></app-icon>
          Aspectos a Evaluar
        </h3>
        
        <div class="bg-surface-elevated border border-divider rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm">
          <span class="text-xs font-bold text-brand">{{ checkedCount }}</span>
          <span class="text-xs text-muted">de {{ items.length }}</span>
        </div>
      </div>
      
      <div class="flex flex-col gap-3">
        @for (item of items; track item.id) {
          <button 
            type="button"
            class="group w-full flex items-center justify-between gap-4 p-4 rounded-2xl border text-left transition-all duration-300 transform active:scale-[0.98]"
            [ngClass]="{
              'bg-brand-muted border-brand shadow-sm': item.checked,
              'bg-surface-base border-border-default hover:border-border-strong': !item.checked
            }"
            (click)="toggleItem(item)"
          >
            <span 
              class="checklist-item-text text-sm transition-colors sm:text-base pr-2 leading-tight flex-1"
              [class.text-checked]="item.checked"
            >
              {{ item.label }}
            </span>
            
            <div 
              class="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300"
              [ngClass]="{
                'border-brand bg-brand scale-110': item.checked,
                'border-border-default border-dashed bg-surface': !item.checked
              }"
            >
              @if (item.checked) {
                <app-icon name="check" [size]="16" class="text-white" />
              }
            </div>
          </button>
        }
      </div>
    </div>
  `,
})
export class EvaluationChecklistComponent {
  @Input() items: EvaluationChecklistItem[] = [];
  @Output() itemsChange = new EventEmitter<EvaluationChecklistItem[]>();

  get checkedCount(): number {
    return this.items.filter(i => i.checked).length;
  }

  toggleItem(item: EvaluationChecklistItem) {
    const updated = this.items.map(i => {
      if (i.id === item.id) {
        return { ...i, checked: !i.checked };
      }
      return i;
    });
    this.itemsChange.emit(updated);
  }
}
