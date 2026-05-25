import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { TaskStatus } from '@core/models/ui/task.model';

interface BadgeConfig {
  icon: string;
  label: string;
  colorVar: string;
  bgVar: string;
}

const STATUS_CONFIG: Record<TaskStatus, BadgeConfig> = {
  pending: {
    icon: 'clock',
    label: 'Pendiente',
    colorVar: 'var(--state-warning)',
    bgVar: 'var(--state-warning-bg)',
  },
  in_progress: {
    icon: 'circle-play',
    label: 'En progreso',
    colorVar: 'var(--ds-brand)',
    bgVar: 'var(--color-primary-muted, rgba(14,165,233,0.1))',
  },
  completed: {
    icon: 'circle-check',
    label: 'Completada',
    colorVar: 'var(--state-success)',
    bgVar: 'var(--state-success-bg)',
  },
};

@Component({
  selector: 'app-task-status-badge',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      [style.color]="config().colorVar"
      [style.background-color]="config().bgVar"
    >
      <app-icon [name]="config().icon" [size]="12" [ariaHidden]="true" />
      {{ config().label }}
    </span>
  `,
})
export class TaskStatusBadgeComponent {
  readonly status = input.required<TaskStatus>();

  readonly config = computed<BadgeConfig>(() => STATUS_CONFIG[this.status()]);
}
