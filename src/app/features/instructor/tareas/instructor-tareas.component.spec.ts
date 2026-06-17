import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InstructorTareasComponent } from './instructor-tareas.component';
import { TasksFacade } from '@core/facades/tasks.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { TaskRow } from '@core/models/ui/task.model';

// ─── helper ───────────────────────────────────────────────────────────────────
let _uid = 0;
function makeTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: `uuid-${++_uid}`,
    branch_id: 1,
    from_user_id: 10,
    from_role: 'secretary',
    to_user_id: 20,
    to_role: 'instructor',
    type: 'task',
    subject: 'Test subject',
    body: null,
    status: 'pending',
    due_date: null,
    completed_at: null,
    seen_at: null,
    seen_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    senderName: 'Secretary',
    recipientName: 'Instructor',
    replyCount: 0,
    isOverdue: false,
    ageInDays: 0,
    recipientInactive: false,
    canEdit: false,
    canChangeStatus: true,
    ...overrides,
  };
}

// ─── suite ────────────────────────────────────────────────────────────────────
describe('InstructorTareasComponent — computed filter signals', () => {
  const receivedTasksSignal = signal<TaskRow[]>([]);

  const mockFacade = {
    receivedTasks: receivedTasksSignal.asReadonly(),
    pendingCount: signal(0).asReadonly(),
    isLoading: signal(false).asReadonly(),
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    selectTask: vi.fn(),
    selectedTask: signal(null).asReadonly(),
  };

  const mockDrawer = { push: vi.fn() };

  let component: InstructorTareasComponent;

  beforeEach(async () => {
    _uid = 0;
    receivedTasksSignal.set([]);

    await TestBed.configureTestingModule({
      imports: [InstructorTareasComponent],
      providers: [
        { provide: TasksFacade, useValue: mockFacade },
        { provide: LayoutDrawerFacadeService, useValue: mockDrawer },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(InstructorTareasComponent);
    component = fixture.componentInstance;
  });

  // ── filteredTasks ────────────────────────────────────────────────────────────

  it('AC1: filtro "all" retorna todas las tareas sin importar tipo', () => {
    receivedTasksSignal.set([
      makeTask({ type: 'task' }),
      makeTask({ type: 'question' }),
      makeTask({ type: 'observation' }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).activeFilter.set('all');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).filteredTasks()).toHaveLength(3);
  });

  it('AC2: filtro "task" muestra solo type="task"', () => {
    receivedTasksSignal.set([
      makeTask({ type: 'task' }),
      makeTask({ type: 'question' }),
      makeTask({ type: 'observation' }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).activeFilter.set('task');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (component as any).filteredTasks() as TaskRow[];
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('task');
  });

  it('AC3: filtro "question" muestra solo type="question"', () => {
    receivedTasksSignal.set([
      makeTask({ type: 'task' }),
      makeTask({ type: 'question' }),
      makeTask({ type: 'question' }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).activeFilter.set('question');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (component as any).filteredTasks() as TaskRow[];
    expect(result).toHaveLength(2);
    result.forEach((t) => expect(t.type).toBe('question'));
  });

  it('AC4: filtro "observation" muestra solo type="observation"', () => {
    receivedTasksSignal.set([makeTask({ type: 'task' }), makeTask({ type: 'observation' })]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).activeFilter.set('observation');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (component as any).filteredTasks() as TaskRow[];
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('observation');
  });

  // ── filterChips badge counts ─────────────────────────────────────────────────

  it('AC5: badge count del chip excluye tareas con status="completed"', () => {
    receivedTasksSignal.set([
      makeTask({ type: 'task', status: 'pending' }),
      makeTask({ type: 'task', status: 'in_progress' }),
      makeTask({ type: 'task', status: 'completed' }),
      makeTask({ type: 'question', status: 'pending' }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chips = (component as any).filterChips() as {
      value: string;
      label: string;
      count: number;
    }[];
    const taskChip = chips.find((c) => c.value === 'task');
    const questionChip = chips.find((c) => c.value === 'question');

    // 2 task activas (pending + in_progress), 1 completada no cuenta
    expect(taskChip?.count).toBe(2);
    // 1 question activa
    expect(questionChip?.count).toBe(1);
  });

  it('AC5: chip "Todas" muestra conteo total de tareas activas de todos los tipos', () => {
    receivedTasksSignal.set([
      makeTask({ type: 'task', status: 'pending' }),
      makeTask({ type: 'question', status: 'in_progress' }),
      makeTask({ type: 'observation', status: 'completed' }), // no cuenta
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chips = (component as any).filterChips() as { value: string; count: number }[];
    const allChip = chips.find((c) => c.value === 'all');
    expect(allChip?.count).toBe(2);
  });

  // ── edge case: tipo sin tareas ───────────────────────────────────────────────

  it('AC-E1: filtro "question" sin consultas → filteredTasks vacío, no crashea', () => {
    receivedTasksSignal.set([makeTask({ type: 'task' }), makeTask({ type: 'observation' })]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (component as any).activeFilter.set('question');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => (component as any).filteredTasks()).not.toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).filteredTasks()).toHaveLength(0);
  });

  // ── reactivity (AC-E2) ───────────────────────────────────────────────────────

  it('AC-E2: cuando receivedTasks cambia, filterChips recalcula automáticamente', () => {
    receivedTasksSignal.set([makeTask({ type: 'task', status: 'pending' })]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const before = (component as any).filterChips() as { value: string; count: number }[];
    expect(before.find((c) => c.value === 'task')?.count).toBe(1);

    // Llega una tarea nueva (simula evento realtime)
    receivedTasksSignal.set([
      makeTask({ type: 'task', status: 'pending' }),
      makeTask({ type: 'task', status: 'pending' }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const after = (component as any).filterChips() as { value: string; count: number }[];
    expect(after.find((c) => c.value === 'task')?.count).toBe(2);
  });

  // ── KPI "En progreso" ────────────────────────────────────────────────────────

  it('KPI: inProgressCount cuenta solo status="in_progress"', () => {
    receivedTasksSignal.set([
      makeTask({ status: 'pending' }),
      makeTask({ status: 'in_progress' }),
      makeTask({ status: 'in_progress' }),
      makeTask({ status: 'completed' }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((component as any).inProgressCount()).toBe(2);
  });
});
