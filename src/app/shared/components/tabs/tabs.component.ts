import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';

export interface TabOption {
  id: string;
  label: string;
  count?: number | null;
  icon?: string;
  disabled?: boolean;
}

export type TabVariant = 'line' | 'segmented' | 'pill';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'line') {
      <div class="flex border-b border-border-default overflow-x-auto custom-scrollbar-hidden" role="tablist">
        @for (tab of tabs(); track tab.id) {
          <button
            role="tab"
            class="flex-1 min-w-[120px] px-4 py-3.5 text-sm font-medium transition-colors border-b-[3px] cursor-pointer flex items-center justify-center gap-1.5"
            [class.border-brand]="activeId() === tab.id"
            [class.border-transparent]="activeId() !== tab.id"
            [style.color]="activeId() === tab.id ? 'var(--ds-brand, var(--text-primary))' : 'var(--text-muted)'"
            [style.border-color]="activeId() === tab.id ? 'var(--ds-brand, var(--color-brand))' : 'transparent'"
            [attr.aria-selected]="activeId() === tab.id"
            [disabled]="tab.disabled"
            (click)="!tab.disabled && activeIdChange.emit(tab.id)"
          >
            @if (tab.icon) {
              <app-icon [name]="tab.icon" [size]="16" />
            }
            <span [class.uppercase]="uppercase()" [class.text-xs]="uppercase()" [class.tracking-wider]="uppercase()">
              {{ tab.label }}
            </span>
            @if (tab.count != null && tab.count > 0) {
              <span class="ml-1.5 inline-flex items-center justify-center rounded-full text-xs w-5 h-5 bg-subtle text-text-muted">
                {{ tab.count }}
              </span>
            }
          </button>
        }
      </div>
    }

    @if (variant() === 'segmented') {
      <div class="flex gap-1 self-start p-1 rounded-lg bg-subtle overflow-x-auto custom-scrollbar-hidden" role="tablist">
        @for (tab of tabs(); track tab.id) {
          <button
            role="tab"
            class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer border-0 flex items-center justify-center gap-1.5 shrink-0"
            [style.background]="activeId() === tab.id ? 'var(--bg-surface)' : 'transparent'"
            [style.color]="activeId() === tab.id ? 'var(--text-primary)' : 'var(--text-muted)'"
            [style.box-shadow]="activeId() === tab.id ? 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,.12))' : 'none'"
            [attr.aria-selected]="activeId() === tab.id"
            [disabled]="tab.disabled"
            (click)="!tab.disabled && activeIdChange.emit(tab.id)"
          >
            @if (tab.icon) {
              <app-icon [name]="tab.icon" [size]="16" />
            }
            <span [class.uppercase]="uppercase()" [class.text-xs]="uppercase()" [class.tracking-wider]="uppercase()">
              {{ tab.label }}
            </span>
            @if (tab.count != null && tab.count > 0) {
              <span class="ml-1.5 inline-flex items-center justify-center rounded-full text-xs px-1.5 bg-border-subtle text-text-muted">
                {{ tab.count }}
              </span>
            }
          </button>
        }
      </div>
    }

    @if (variant() === 'pill') {
      <div class="flex flex-wrap gap-2 overflow-x-auto custom-scrollbar-hidden" role="tablist">
        @for (tab of tabs(); track tab.id) {
          <button
            type="button"
            role="tab"
            class="relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all outline-none whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5"
            [class.text-brand]="activeId() === tab.id"
            [class.text-text-muted]="activeId() !== tab.id"
            [class.hover:text-text-primary]="activeId() !== tab.id"
            [attr.aria-selected]="activeId() === tab.id"
            [disabled]="tab.disabled"
            (click)="!tab.disabled && activeIdChange.emit(tab.id)"
          >
            @if (activeId() === tab.id) {
              <div class="absolute inset-0 bg-brand-muted border border-brand/20 rounded-xl shadow-sm z-0"></div>
            } @else {
              <div class="absolute inset-0 bg-surface border border-border-subtle rounded-xl z-0"></div>
            }
            <span class="relative z-10 flex items-center gap-2">
              @if (tab.icon) {
                <app-icon [name]="tab.icon" [size]="16" [class.text-brand]="activeId() === tab.id" />
              }
              <span [class.uppercase]="uppercase()" [class.text-xs]="uppercase()" [class.tracking-wider]="uppercase()">
                {{ tab.label }}
              </span>
              @if (tab.count != null && tab.count > 0) {
                <span class="inline-flex items-center justify-center rounded-full text-xs px-1.5 bg-surface text-text-muted border border-border-subtle">
                  {{ tab.count }}
                </span>
              }
            </span>
          </button>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .custom-scrollbar-hidden {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .custom-scrollbar-hidden::-webkit-scrollbar {
      display: none;
    }
  `]
})
export class TabsComponent {
  tabs = input.required<TabOption[]>();
  activeId = input.required<string>();
  variant = input<TabVariant>('line');
  uppercase = input<boolean>(false);
  
  activeIdChange = output<string>();
}
