import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 mb-6">
      <div>
         <div class="flex items-center gap-2">
            <a *ngIf="backUrl" [routerLink]="backUrl" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-hover text-text-muted transition-colors mr-1">
               <lucide-icon name="arrow-left" [size]="20"></lucide-icon>
            </a>
            <h1 class="text-2xl font-bold text-text-primary m-0">{{ title }}</h1>
         </div>
         <p *ngIf="subtitle" class="text-sm text-text-secondary mt-1">{{ subtitle }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-3 shrink-0">
         <ng-content select="[actions]"></ng-content>
      </div>
    </div>
  `
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() backUrl?: string;
}
