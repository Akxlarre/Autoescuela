import { Injectable, signal } from '@angular/core';
import type { TaskType } from '@core/models/ui/task.model';

@Injectable({ providedIn: 'root' })
export class TaskCreateContextService {
  readonly initialType = signal<TaskType>('task');

  prime(type: TaskType): void {
    this.initialType.set(type);
  }

  reset(): void {
    this.initialType.set('task');
  }
}
