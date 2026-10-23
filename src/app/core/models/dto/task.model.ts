export type TaskType = 'task' | 'observation' | 'question';
/** `seen`: observación abierta por su destinatario (spec 0001-b AC5, fix-231-b). */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'seen';
export type TaskFromRole = 'admin' | 'secretary';
export type TaskToRole = 'admin' | 'secretary' | 'instructor';

export interface Task {
  id: string; // uuid
  branch_id: number;
  from_user_id: number;
  from_role: TaskFromRole;
  to_user_id: number;
  to_role: TaskToRole;
  type: TaskType;
  subject: string;
  body: string | null;
  status: TaskStatus;
  due_date: string | null; // solo si type='task'
  completed_at: string | null;
  seen_at: string | null;
  seen_by: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
