import { describe, it, expect, beforeEach } from 'vitest';
import { TaskCreateContextService } from './task-create-context.service';

describe('TaskCreateContextService', () => {
  let service: TaskCreateContextService;

  beforeEach(() => {
    service = new TaskCreateContextService();
  });

  it('arranca con el tipo por defecto "task"', () => {
    expect(service.initialType()).toBe('task');
  });

  it('prime() fija el tipo inicial para el modal', () => {
    service.prime('reminder');
    expect(service.initialType()).toBe('reminder');
  });

  it('reset() vuelve al tipo por defecto', () => {
    service.prime('reminder');
    service.reset();
    expect(service.initialType()).toBe('task');
  });

  it('spec 0053-b: primeEdit() deja la tarea a editar y reset() la limpia', () => {
    const tarea = { id: 'uuid-1', subject: 'A' } as never;
    expect(service.editing()).toBeNull();
    service.primeEdit(tarea);
    expect(service.editing()).toBe(tarea);
    service.reset();
    expect(service.editing()).toBeNull();
  });
});
