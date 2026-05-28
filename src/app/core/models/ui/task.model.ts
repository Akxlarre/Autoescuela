import type { Task as TaskDto, TaskStatus, TaskType } from '@core/models/dto/task.model';
import type { TaskReply } from '@core/models/dto/task-reply.model';

export type { TaskType, TaskStatus } from '@core/models/dto/task.model';

export interface TaskRow extends TaskDto {
  senderName: string;
  recipientName: string;
  replyCount: number;
  isOverdue: boolean;
  ageInDays: number;
  recipientInactive: boolean;
  canEdit: boolean; // emisor + status='pending'
  canChangeStatus: boolean; // destinatario (o emisor según tipo)
  canDelete: boolean; // admin siempre | emisor solo si status='pending'
}

export interface TaskWithReplies extends TaskRow {
  replies: TaskReply[];
}

export type TaskFilter = 'all' | 'sent' | 'received' | 'pending' | 'overdue';

export type RoleMatrixKey = `${TaskDto['from_role']}->${TaskDto['to_role']}`;

export interface CreateTaskPayload {
  type: TaskType;
  to_user_id: number;
  to_role: TaskDto['to_role'];
  subject: string;
  body?: string | null;
  due_date?: string | null;
}

export interface RecipientOption {
  dbId: number;
  name: string;
  role: TaskDto['to_role'];
  branchId: number;
}
