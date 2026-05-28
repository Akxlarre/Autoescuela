import type { Task, TaskFromRole, TaskToRole } from '@core/models/dto/task.model';
import type { TaskRow } from '@core/models/ui/task.model';

// Matriz de roles permitidos (AC-E1)
// admin → {secretary, instructor}
// secretary → {admin, instructor}
// instructor → nadie (receptor puro en v1)
const ALLOWED: Record<TaskFromRole, TaskToRole[]> = {
  admin: ['secretary', 'instructor'],
  secretary: ['admin', 'instructor'],
};

export function canSendTo(fromRole: TaskFromRole, toRole: TaskToRole): boolean {
  return ALLOWED[fromRole]?.includes(toRole) ?? false;
}

export function isOverdue(dueDate: string | null, now: Date): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < now;
}

export function canEditTask(task: Task, currentUserId: number): boolean {
  return task.from_user_id === currentUserId && task.status === 'pending';
}

export function canDeleteTask(task: Task, currentUserId: number, currentRole: string): boolean {
  if (currentRole === 'admin') return true;
  return task.from_user_id === currentUserId && task.status === 'pending';
}

export function canChangeStatus(task: Task, currentUserId: number): boolean {
  if (task.status === 'completed') return false;
  if (task.to_user_id === currentUserId) return true;
  // Question sender can also close the question once satisfied with the answer
  if (task.type === 'question' && task.from_user_id === currentUserId) return true;
  return false;
}

export function formatTaskAge(createdAt: string, now: Date): string {
  const diffMs = now.getTime() - new Date(createdAt).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  const weeks = Math.floor(days / 7);
  return `hace ${weeks}sem`;
}

export function mapTaskDtoToRow(
  dto: Task,
  senderName: string,
  recipientName: string,
  replyCount: number,
  currentUserId: number,
  recipientInactive: boolean,
  now: Date,
  currentRole: string,
): TaskRow {
  const ageInDays = Math.floor((now.getTime() - new Date(dto.created_at).getTime()) / 86_400_000);

  return {
    ...dto,
    senderName,
    recipientName,
    replyCount,
    isOverdue: isOverdue(dto.due_date, now),
    ageInDays,
    recipientInactive,
    canEdit: canEditTask(dto, currentUserId),
    canChangeStatus: canChangeStatus(dto, currentUserId),
    canDelete: canDeleteTask(dto, currentUserId, currentRole),
  };
}
