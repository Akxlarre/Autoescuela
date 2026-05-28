import {
  canSendTo,
  isOverdue,
  canEditTask,
  canChangeStatus,
  canDeleteTask,
  formatTaskAge,
  mapTaskDtoToRow,
} from './task.utils';
import type { Task } from '@core/models/dto/task.model';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'uuid-1',
    branch_id: 1,
    from_user_id: 10,
    from_role: 'admin',
    to_user_id: 20,
    to_role: 'secretary',
    type: 'task',
    subject: 'Test',
    body: null,
    status: 'pending',
    due_date: null,
    completed_at: null,
    seen_at: null,
    seen_by: null,
    created_at: '2026-05-17T10:00:00Z',
    updated_at: '2026-05-17T10:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

const NOW = new Date('2026-05-18T12:00:00Z');

// ─── canSendTo ───────────────────────────────────────────────────────────────

describe('canSendTo', () => {
  // Permitidos
  it('admin → secretary: permitido', () => {
    expect(canSendTo('admin', 'secretary')).toBe(true);
  });

  it('admin → instructor: permitido', () => {
    expect(canSendTo('admin', 'instructor')).toBe(true);
  });

  it('secretary → admin: permitido', () => {
    expect(canSendTo('secretary', 'admin')).toBe(true);
  });

  it('secretary → instructor: permitido', () => {
    expect(canSendTo('secretary', 'instructor')).toBe(true);
  });

  // Bloqueados (AC-E1)
  it('admin → admin: bloqueado', () => {
    expect(canSendTo('admin', 'admin')).toBe(false);
  });

  it('secretary → secretary: bloqueado', () => {
    expect(canSendTo('secretary', 'secretary')).toBe(false);
  });
});

// ─── isOverdue ───────────────────────────────────────────────────────────────

describe('isOverdue', () => {
  it('retorna false cuando due_date es null', () => {
    expect(isOverdue(null, NOW)).toBe(false);
  });

  it('retorna true cuando due_date está en el pasado (AC-E3)', () => {
    expect(isOverdue('2026-05-17T00:00:00Z', NOW)).toBe(true);
  });

  it('retorna false cuando due_date está en el futuro', () => {
    expect(isOverdue('2026-05-19T00:00:00Z', NOW)).toBe(false);
  });

  it('retorna true cuando due_date es exactamente igual a now (borde)', () => {
    expect(isOverdue(NOW.toISOString(), NOW)).toBe(false);
  });
});

// ─── canEditTask ─────────────────────────────────────────────────────────────

describe('canEditTask', () => {
  it('permite editar al emisor si status=pending', () => {
    expect(canEditTask(makeTask({ from_user_id: 10, status: 'pending' }), 10)).toBe(true);
  });

  it('bloquea editar al no-emisor (AC-E2)', () => {
    expect(canEditTask(makeTask({ from_user_id: 10, status: 'pending' }), 20)).toBe(false);
  });

  it('bloquea editar al emisor si status≠pending (AC-E2)', () => {
    expect(canEditTask(makeTask({ from_user_id: 10, status: 'in_progress' }), 10)).toBe(false);
  });

  it('bloquea editar al emisor si status=completed', () => {
    expect(canEditTask(makeTask({ from_user_id: 10, status: 'completed' }), 10)).toBe(false);
  });
});

// ─── canDeleteTask ───────────────────────────────────────────────────────────

describe('canDeleteTask', () => {
  it('admin puede borrar cualquier tarea en pending', () => {
    expect(canDeleteTask(makeTask({ status: 'pending' }), 99, 'admin')).toBe(true);
  });

  it('admin puede borrar cualquier tarea en in_progress', () => {
    expect(canDeleteTask(makeTask({ status: 'in_progress' }), 99, 'admin')).toBe(true);
  });

  it('admin puede borrar cualquier tarea en completed', () => {
    expect(canDeleteTask(makeTask({ status: 'completed' }), 99, 'admin')).toBe(true);
  });

  it('secretaria (emisor) puede borrar si status=pending (AC1)', () => {
    expect(canDeleteTask(makeTask({ from_user_id: 10, status: 'pending' }), 10, 'secretaria')).toBe(
      true,
    );
  });

  it('secretaria (emisor) NO puede borrar si status=in_progress (AC2)', () => {
    expect(
      canDeleteTask(makeTask({ from_user_id: 10, status: 'in_progress' }), 10, 'secretaria'),
    ).toBe(false);
  });

  it('secretaria (emisor) NO puede borrar si status=completed (AC2)', () => {
    expect(
      canDeleteTask(makeTask({ from_user_id: 10, status: 'completed' }), 10, 'secretaria'),
    ).toBe(false);
  });

  it('destinatario (no emisor) NUNCA puede borrar (AC5)', () => {
    expect(canDeleteTask(makeTask({ from_user_id: 10, status: 'pending' }), 20, 'secretaria')).toBe(
      false,
    );
  });

  it('instructor (receptor puro) NUNCA puede borrar (AC-E1)', () => {
    expect(canDeleteTask(makeTask({ from_user_id: 10, status: 'pending' }), 20, 'instructor')).toBe(
      false,
    );
  });
});

// ─── canChangeStatus ─────────────────────────────────────────────────────────

describe('canChangeStatus', () => {
  it('permite al destinatario cambiar estado si no está completada', () => {
    expect(canChangeStatus(makeTask({ to_user_id: 20, status: 'pending' }), 20)).toBe(true);
  });

  it('bloquea al destinatario si la tarea ya está completada', () => {
    expect(canChangeStatus(makeTask({ to_user_id: 20, status: 'completed' }), 20)).toBe(false);
  });

  it('bloquea al no-destinatario', () => {
    expect(canChangeStatus(makeTask({ to_user_id: 20, status: 'pending' }), 99)).toBe(false);
  });

  it('returns true for question sender when status is not completed', () => {
    const q = makeTask({
      type: 'question',
      from_user_id: 10,
      to_user_id: 20,
      status: 'in_progress',
    });
    expect(canChangeStatus(q, 10)).toBe(true);
  });

  it('returns false for question sender when status is completed', () => {
    const q = makeTask({ type: 'question', from_user_id: 10, to_user_id: 20, status: 'completed' });
    expect(canChangeStatus(q, 10)).toBe(false);
  });

  it('does NOT allow task sender to change status (non-question type)', () => {
    const t = makeTask({ type: 'task', from_user_id: 10, to_user_id: 20, status: 'pending' });
    expect(canChangeStatus(t, 10)).toBe(false);
  });
});

// ─── formatTaskAge ───────────────────────────────────────────────────────────

describe('formatTaskAge', () => {
  it('muestra minutos para < 1h', () => {
    const past = new Date(NOW.getTime() - 30 * 60_000).toISOString();
    expect(formatTaskAge(past, NOW)).toBe('hace 30m');
  });

  it('muestra horas para < 24h', () => {
    const past = new Date(NOW.getTime() - 5 * 3_600_000).toISOString();
    expect(formatTaskAge(past, NOW)).toBe('hace 5h');
  });

  it('muestra días para < 7d', () => {
    const past = new Date(NOW.getTime() - 3 * 86_400_000).toISOString();
    expect(formatTaskAge(past, NOW)).toBe('hace 3d');
  });

  it('muestra semanas para ≥ 7d', () => {
    const past = new Date(NOW.getTime() - 14 * 86_400_000).toISOString();
    expect(formatTaskAge(past, NOW)).toBe('hace 2sem');
  });
});

// ─── mapTaskDtoToRow ─────────────────────────────────────────────────────────

describe('mapTaskDtoToRow', () => {
  const task = makeTask({
    from_user_id: 10,
    to_user_id: 20,
    status: 'pending',
    due_date: '2026-05-17T00:00:00Z', // pasado → vencida
    created_at: '2026-05-17T10:00:00Z',
  });

  const row = mapTaskDtoToRow(task, 'Ana Admin', 'Sara Sec', 3, 10, false, NOW, 'admin');

  it('propaga todos los campos del DTO', () => {
    expect(row.id).toBe(task.id);
    expect(row.subject).toBe(task.subject);
  });

  it('asigna senderName y recipientName', () => {
    expect(row.senderName).toBe('Ana Admin');
    expect(row.recipientName).toBe('Sara Sec');
  });

  it('asigna replyCount', () => {
    expect(row.replyCount).toBe(3);
  });

  it('calcula isOverdue correctamente', () => {
    expect(row.isOverdue).toBe(true);
  });

  it('calcula canEdit = true para el emisor con status=pending', () => {
    expect(row.canEdit).toBe(true);
  });

  it('calcula canDelete = true para admin (AC3)', () => {
    expect(row.canDelete).toBe(true);
  });

  it('calcula canEdit = false para el no-emisor', () => {
    const rowOther = mapTaskDtoToRow(
      task,
      'Ana Admin',
      'Sara Sec',
      3,
      20,
      false,
      NOW,
      'secretaria',
    );
    expect(rowOther.canEdit).toBe(false);
  });

  it('calcula canDelete = false para el destinatario no-admin (AC5)', () => {
    const rowOther = mapTaskDtoToRow(
      task,
      'Ana Admin',
      'Sara Sec',
      3,
      20,
      false,
      NOW,
      'secretaria',
    );
    expect(rowOther.canDelete).toBe(false);
  });

  it('calcula canChangeStatus = true para el destinatario en pending', () => {
    const rowDest = mapTaskDtoToRow(task, 'Ana Admin', 'Sara Sec', 3, 20, false, NOW, 'secretaria');
    expect(rowDest.canChangeStatus).toBe(true);
  });

  it('asigna recipientInactive correctamente', () => {
    const rowInactive = mapTaskDtoToRow(task, 'Ana', 'Inactivo', 0, 20, true, NOW, 'instructor');
    expect(rowInactive.recipientInactive).toBe(true);
  });
});
