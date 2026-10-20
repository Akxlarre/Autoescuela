import { chileWallTimeToInstant } from './chile-time.utils';
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

/**
 * Una tarea completada nunca está vencida (S10, hotfix-100-b): antes salía "Vencida" y contaba
 * en el KPI aunque ya estuviera hecha.
 */
export function isOverdue(dueDate: string | null, now: Date, status?: Task['status']): boolean {
  if (!dueDate || status === 'completed') return false;
  return new Date(dueDate) < now;
}

/**
 * Instante que se guarda en `tasks.due_date` (timestamptz) para una fecha límite elegida como
 * día `AAAA-MM-DD`: las 23:59 de ese día en Chile (S9, hotfix-100-b). Guardar el día tal cual
 * era medianoche UTC = 21:00 del día anterior en Chile — se mostraba un día antes y salía
 * "Vencida" desde la noche previa.
 */
export function dueDateToInstant(day: string): string {
  return chileWallTimeToInstant(day, '23:59');
}

/**
 * Filtro PostgREST (`.or(...)`) de la lista de tareas con una sede elegida (hotfix-101-b, S8):
 * la sede acota las tareas ajenas, pero lo que el usuario envió o recibió se ve siempre. Una
 * tarea secretaria → admin queda con la sede de la secretaria; filtrar solo por `branch_id`
 * le escondía al admin lo que le mandaban desde la otra sede.
 */
export function taskBranchScopeFilter(branchId: number, userId: number): string {
  return `branch_id.eq.${branchId},from_user_id.eq.${userId},to_user_id.eq.${userId}`;
}

/**
 * Pestaña "Enviadas" de la secretaria (hotfix-102-b, S23): todo lo que envió que no es una
 * observación — tareas y consultas, al admin y a instructores, incluidas las completadas.
 * Antes solo veía lo enviado a instructores: lo que le mandaba al admin no aparecía en ningún lado.
 */
export function sentNonObservations<T extends Pick<Task, 'type'>>(sent: T[]): T[] {
  return sent.filter((t) => t.type !== 'observation');
}

export function canEditTask(task: Task, currentUserId: number): boolean {
  return task.from_user_id === currentUserId && task.status === 'pending';
}

export function canDeleteTask(task: Task, currentUserId: number, currentRole: string): boolean {
  if (currentRole === 'admin') return true;
  return task.from_user_id === currentUserId && task.status === 'pending';
}

/**
 * La tarea sigue abierta (cuenta en los contadores de pendientes): pendiente o en curso. Una
 * completada o una observación ya vista (fix-231-b) no.
 */
export function isTaskOpen(status: Task['status']): boolean {
  return status === 'pending' || status === 'in_progress';
}

export function canChangeStatus(task: Task, currentUserId: number): boolean {
  if (!isTaskOpen(task.status)) return false;
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
    isOverdue: isOverdue(dto.due_date, now, dto.status),
    ageInDays,
    recipientInactive,
    canEdit: canEditTask(dto, currentUserId),
    canChangeStatus: canChangeStatus(dto, currentUserId),
    canDelete: canDeleteTask(dto, currentUserId, currentRole),
  };
}
