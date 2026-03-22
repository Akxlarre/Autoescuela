import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center justify-center px-2.5 py-1 text-xs font-semibold rounded-full" [ngClass]="getClasses()">
      <ng-content></ng-content>
    </span>
  `
})
export class BadgeComponent {
  @Input() variant: 'success' | 'warning' | 'error' | 'info' | 'default' | 'neutral' | string = 'default';
  
  getClasses() {
    switch (this.variant) {
      case 'success': return 'bg-[var(--state-success-bg)] text-[var(--state-success)] dark:bg-[var(--state-success-bg)]/30 dark:text-[var(--state-success)]';
      case 'warning': return 'bg-[var(--state-warning-bg)] text-[var(--state-warning)] dark:bg-[var(--state-warning-bg)]/30 dark:text-[var(--state-warning)]';
      case 'error': return 'bg-[var(--state-error-bg)] text-red-700 dark:bg-[var(--state-error-bg)]/30 dark:text-[var(--state-error)]';
      case 'info': return 'bg-brand-muted text-brand-primary dark:bg-brand-muted/30 dark:text-brand-primary';
      case 'neutral': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      default: 
         // Allows passing literal class strings
         if (this.variant.includes('bg-')) return this.variant;
         return 'bg-brand-muted text-brand-primary';
    }
  }
}
