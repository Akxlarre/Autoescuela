import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { ToastService } from '@core/services/ui/toast.service';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Task, TaskFromRole, TaskToRole } from '@core/models/dto/task.model';
import type { TaskReply } from '@core/models/dto/task-reply.model';
import type {
  TaskRow,
  TaskStatus,
  CreateTaskPayload,
  RecipientOption,
} from '@core/models/ui/task.model';
import { canSendTo, isOverdue, mapTaskDtoToRow } from '@core/utils/task.utils';

// Maps currentUser().role (runtime value = DB roles.name) → TaskFromRole
// DB seed stores 'secretary' (English), not 'secretaria'
// Keys are runtime values from currentUser().role (AuthFacade maps DB roles to Spanish):
//   DB 'secretary' → runtime 'secretaria'
//   DB 'student'   → runtime 'alumno'
// ROLE_NAME_TO_TASK_ROLE (below) uses raw DB values from the roles join.
const UI_TO_TASK_ROLE: Record<string, TaskFromRole | null> = {
  admin: 'admin',
  secretaria: 'secretary',
  instructor: null,
  alumno: null,
  unknown: null,
};

// Maps DB roles.name → TaskToRole
// DB seed stores 'secretary' (English), 'instructor', 'admin'
const ROLE_NAME_TO_TASK_ROLE: Record<string, TaskToRole | null> = {
  admin: 'admin',
  secretary: 'secretary',
  instructor: 'instructor',
  student: null,
};

type RawTaskRow = Task & {
  from_user: { first_names: string; paternal_last_name: string; active: boolean } | null;
  to_user: { first_names: string; paternal_last_name: string; active: boolean } | null;
  reply_count: Array<{ count: number }>;
};

@Injectable({ providedIn: 'root' })
export class TasksFacade {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthFacade);
  private branchFacade = inject(BranchFacade);
  private notifications = inject(NotificationsFacade);
  private toast = inject(ToastService);

  // 1. ESTADO PRIVADO
  private _tasks = signal<TaskRow[]>([]);
  private _isLoading = signal(false);
  private _error = signal<string | null>(null);
  private _selectedTaskId = signal<string | null>(null);
  private _recipients = signal<RecipientOption[]>([]);
  private _selectedTaskReplies = signal<TaskReply[]>([]);
  private _initialized = false;
  private _sentChannel: RealtimeChannel | null = null;
  private _receivedChannel: RealtimeChannel | null = null;

  // 2. ESTADO PÚBLICO READONLY
  readonly tasks = this._tasks.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly recipients = this._recipients.asReadonly();
  readonly selectedTaskReplies = this._selectedTaskReplies.asReadonly();

  // Tasks where the current user is sender OR recipient (personal scope).
  // For admin, _tasks contains all branch tasks (RLS allows it), so this computed
  // prevents counting tasks between other users in the branch KPIs (pendingCount,
  // overdueCount). For secretary/instructor, _tasks is already scoped by RLS.
  private readonly myTasks = computed<TaskRow[]>(() => {
    const dbId = this.auth.currentUser()?.dbId;
    return this._tasks().filter((t) => t.from_user_id === dbId || t.to_user_id === dbId);
  });

  readonly pendingCount = computed(
    () => this.myTasks().filter((t) => t.status === 'pending').length,
  );
  readonly overdueCount = computed(() => this.myTasks().filter((t) => t.isOverdue).length);

  readonly sentTasks = computed<TaskRow[]>(() => {
    const dbId = this.auth.currentUser()?.dbId;
    return this._tasks().filter((t) => t.from_user_id === dbId);
  });

  readonly receivedTasks = computed<TaskRow[]>(() => {
    const dbId = this.auth.currentUser()?.dbId;
    return this._tasks().filter((t) => t.to_user_id === dbId);
  });

  readonly observationTasks = computed<TaskRow[]>(() => {
    const dbId = this.auth.currentUser()?.dbId;
    return this._tasks().filter(
      (t) => t.type === 'observation' && (t.from_user_id === dbId || t.to_user_id === dbId),
    );
  });

  readonly selectedTask = computed<TaskRow | undefined>(() => {
    const id = this._selectedTaskId();
    if (!id) return undefined;
    return this._tasks().find((t) => t.id === id);
  });

  // 3. MÉTODOS DE CICLO DE VIDA

  async initialize(): Promise<void> {
    if (this._initialized) {
      this.refreshSilently();
      return;
    }
    this._initialized = true;
    this._isLoading.set(true);
    try {
      await this.fetchData();
      const dbId = this.auth.currentUser()?.dbId;
      if (dbId) this.subscribeRealtime(dbId);
    } catch {
      this._error.set('Error al cargar tareas');
    } finally {
      this._isLoading.set(false);
    }
  }

  private async refreshSilently(): Promise<void> {
    try {
      await this.fetchData();
    } catch {
      // fail silently — stale data stays visible
    }
  }

  dispose(): void {
    this._initialized = false;
    this.disposeRealtime();
  }

  // 4. FETCH

  private async fetchData(): Promise<void> {
    const branchId = this.branchFacade.selectedBranchId();
    const currentUser = this.auth.currentUser();
    if (!currentUser?.dbId) return;

    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();

    let query = this.supabase.client
      .from('tasks')
      .select(
        `*, from_user:users!from_user_id(first_names, paternal_last_name, active), to_user:users!to_user_id(first_names, paternal_last_name, active), reply_count:task_replies(count)`,
      )
      .is('deleted_at', null)
      .or(`status.neq.completed,created_at.gte.${ninetyDaysAgo}`);

    if (branchId !== null) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const now = new Date();
    const rows: TaskRow[] = ((data ?? []) as RawTaskRow[]).map((raw) => {
      const senderName =
        `${raw.from_user?.first_names ?? ''} ${raw.from_user?.paternal_last_name ?? ''}`.trim();
      const recipientName =
        `${raw.to_user?.first_names ?? ''} ${raw.to_user?.paternal_last_name ?? ''}`.trim();
      const replyCount = raw.reply_count?.[0]?.count ?? 0;
      const recipientInactive = raw.to_user?.active === false;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { from_user, to_user, reply_count, ...dto } = raw;
      return mapTaskDtoToRow(
        dto as Task,
        senderName,
        recipientName,
        replyCount,
        currentUser.dbId!,
        recipientInactive,
        now,
        currentUser.role,
      );
    });

    this._tasks.set(rows);
  }

  // 5. MUTACIONES

  async createTask(payload: CreateTaskPayload): Promise<boolean> {
    const currentUser = this.auth.currentUser();
    if (!currentUser?.dbId) return false;

    const fromRole = UI_TO_TASK_ROLE[currentUser.role] as TaskFromRole | null;
    if (!fromRole || !canSendTo(fromRole, payload.to_role as TaskToRole)) return false;

    const recipient = this._recipients().find((r) => r.dbId === payload.to_user_id);
    if (!recipient) return false;

    const insertPayload: Record<string, unknown> = {
      // Sender's branch takes priority (e.g. secretary→admin where admin has null branch_id)
      branch_id: currentUser.branchId ?? recipient.branchId,
      from_user_id: currentUser.dbId,
      from_role: fromRole,
      to_user_id: payload.to_user_id,
      to_role: payload.to_role,
      type: payload.type,
      subject: payload.subject,
      body: payload.body ?? null,
      status: 'pending',
    };

    if (payload.type === 'task' && payload.due_date) {
      insertPayload['due_date'] = payload.due_date;
    }

    try {
      const { error } = await this.supabase.client.from('tasks').insert(insertPayload);
      if (error) throw error;

      this.notifications
        .createNotification({
          recipientId: payload.to_user_id,
          type: 'system',
          subject: `Nueva tarea: ${payload.subject}`,
          message: `Tienes una nueva tarea asignada: ${payload.subject}`,
          referenceType: 'task',
        })
        .catch(() => this.toast.warning('No se pudo enviar la notificación'));

      await this.refreshSilently();
      this.toast.success('Tarea enviada correctamente');
      return true;
    } catch {
      this.toast.error('Error al crear la tarea');
      return false;
    }
  }

  async updateStatus(taskId: string, status: TaskStatus): Promise<boolean> {
    const updatePayload: Record<string, unknown> = { status };
    if (status === 'completed') {
      updatePayload['completed_at'] = new Date().toISOString();
    }

    try {
      const { error } = await this.supabase.client
        .from('tasks')
        .update(updatePayload)
        .eq('id', taskId);
      if (error) throw error;
      await this.refreshSilently();
      return true;
    } catch {
      this.toast.error('Error al actualizar el estado');
      return false;
    }
  }

  async markSeen(taskId: string): Promise<void> {
    const currentUser = this.auth.currentUser();
    if (!currentUser?.dbId) return;

    const now = new Date().toISOString();
    try {
      await this.supabase.client
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: now,
          seen_at: now,
          seen_by: currentUser.dbId,
        })
        .eq('id', taskId);
      await this.refreshSilently();
    } catch {
      // Non-critical — fail silently
    }
  }

  async addReply(taskId: string, body: string): Promise<boolean> {
    const currentUser = this.auth.currentUser();
    if (!currentUser?.dbId) return false;

    try {
      const { error } = await this.supabase.client.from('task_replies').insert({
        task_id: taskId,
        from_user_id: currentUser.dbId,
        body,
      });
      if (error) throw error;

      // Auto-advance question from pending → in_progress on first reply
      const task = this._tasks().find((t) => t.id === taskId);
      if (task?.type === 'question' && task.status === 'pending') {
        await this.supabase.client.from('tasks').update({ status: 'in_progress' }).eq('id', taskId);
      }

      await this.refreshSilently();
      return true;
    } catch {
      this.toast.error('Error al enviar la respuesta');
      return false;
    }
  }

  async softDelete(taskId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.client.rpc('soft_delete_task', {
        p_task_id: taskId,
      });
      if (error) throw error;
      if (!data) return false;
      await this.refreshSilently();
      return true;
    } catch {
      this.toast.error('Error al eliminar la tarea');
      return false;
    }
  }

  selectTask(taskId: string | null): void {
    this._selectedTaskId.set(taskId);
  }

  async loadRecipients(): Promise<void> {
    const currentUser = this.auth.currentUser();
    if (!currentUser?.dbId) return;

    const fromRole = UI_TO_TASK_ROLE[currentUser.role] as TaskFromRole | null;
    if (!fromRole) return;

    const branchId = this.branchFacade.selectedBranchId();

    let query = this.supabase.client
      .from('users')
      .select('id, first_names, paternal_last_name, branch_id, roles!role_id(name)')
      .eq('active', true)
      .neq('id', currentUser.dbId);

    // Branch filter only for admin — secretary's RLS policy already scopes results
    // (admin rows are cross-branch visible for secretary via migration 004).
    // Applying branch_id=X here would filter out admins whose branch_id differs.
    if (branchId !== null && fromRole === 'admin') {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) return;

    const options: RecipientOption[] = (
      (data ?? []) as unknown as Array<{
        id: number;
        first_names: string;
        paternal_last_name: string;
        branch_id: number;
        roles: { name: string } | Array<{ name: string }> | null;
      }>
    )
      .map((u) => {
        const rolesData = Array.isArray(u.roles) ? u.roles[0] : u.roles;
        const roleName = rolesData?.name ?? '';
        const taskRole = ROLE_NAME_TO_TASK_ROLE[roleName] ?? null;
        if (!taskRole || !canSendTo(fromRole, taskRole)) return null;
        return {
          dbId: u.id,
          name: `${u.first_names} ${u.paternal_last_name}`.trim(),
          role: taskRole,
          branchId: u.branch_id,
        } satisfies RecipientOption;
      })
      .filter((o): o is RecipientOption => o !== null);

    this._recipients.set(options);
  }

  async loadReplies(taskId: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('task_replies')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) return;
    this._selectedTaskReplies.set((data ?? []) as TaskReply[]);
  }

  // 6. REALTIME

  private subscribeRealtime(dbId: number): void {
    this.disposeRealtime();

    this._sentChannel = this.supabase.client
      .channel(`tasks-sent-${dbId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `from_user_id=eq.${dbId}` },
        () => this.refreshSilently(),
      )
      .subscribe();

    this._receivedChannel = this.supabase.client
      .channel(`tasks-received-${dbId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `to_user_id=eq.${dbId}` },
        () => this.refreshSilently(),
      )
      .subscribe();
  }

  private disposeRealtime(): void {
    if (this._sentChannel) {
      this.supabase.client.removeChannel(this._sentChannel);
      this._sentChannel = null;
    }
    if (this._receivedChannel) {
      this.supabase.client.removeChannel(this._receivedChannel);
      this._receivedChannel = null;
    }
  }
}
