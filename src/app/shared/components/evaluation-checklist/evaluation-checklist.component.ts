import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import type { EvaluationChecklistItem } from '@core/models/ui/instructor-portal.model';

@Component({
  selector: 'app-evaluation-checklist',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
        <lucide-icon name="list-checks" [size]="16" class="text-brand-primary"></lucide-icon>
        Aspectos a Evaluar
      </h3>
      
      <div class="border border-divider rounded-lg overflow-hidden bg-surface">
        <div 
          *ngFor="let item of items; let last = last"
          class="flex items-center gap-3 p-3 transition-colors cursor-pointer group hover:bg-surface-hover"
          [class.border-b]="!last"
          [class.border-divider]="!last"
          (click)="toggleItem(item)"
        >
          <div 
            class="w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors"
            [class.border-divider]="!item.checked"
            [class.border-brand-primary]="item.checked"
            [class.bg-brand-primary]="item.checked"
            [class.bg-surface]="!item.checked"
          >
            <lucide-icon 
              name="check" 
              [size]="14" 
              class="text-surface"
              *ngIf="item.checked"
            ></lucide-icon>
          </div>
          <span 
            class="text-sm select-none transition-colors"
            [class.text-text-primary]="!item.checked"
            [class.text-text-muted]="item.checked"
            [class.line-through]="item.checked"
          >
            {{ item.label }}
          </span>
        </div>
      </div>
      
      <p class="text-xs text-text-muted mt-2">
        <span class="font-medium text-text-primary">{{ checkedCount }}</span> de {{ items.length }} aspectos completados satisfactoriamente.
      </p>
    </div>
  `
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
    
    // Si queremos mutar o emitir uno nuevo:
    // Aquí es mejor emitir la nueva lista y mutar si se usa signal o two-way binding
    this.itemsChange.emit(updated);
  }
}
