export interface TaskReply {
  id: string; // uuid
  task_id: string; // uuid → tasks.id
  from_user_id: number;
  body: string;
  created_at: string;
}
