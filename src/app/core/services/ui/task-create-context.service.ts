import { Injectable, signal } from '@angular/core';
import type { TaskRow, TaskType } from '@core/models/ui/task.model';

/**
 * Contexto que se le pasa a `TaskCreateDrawerComponent` antes de abrirlo (el servicio de drawers no
 * pasa inputs): el tipo inicial al crear, o la tarea a editar (spec 0053-b).
 */
@Injectable({ providedIn: 'root' })
export class TaskCreateContextService {
  readonly initialType = signal<TaskType>('task');
  /** Tarea que se edita; null = el drawer crea una nueva. */
  readonly editing = signal<TaskRow | null>(null);

  prime(type: TaskType): void {
    this.initialType.set(type);
  }

  primeEdit(task: TaskRow): void {
    this.editing.set(task);
  }

  reset(): void {
    this.initialType.set('task');
    this.editing.set(null);
  }
}
