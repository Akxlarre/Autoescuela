import { Injectable, inject, signal, computed } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { mapNotificationDtoToUi, groupNotifications } from '@core/utils/notification.utils';
import type { Notification as NotificationDto } from '@core/models/dto/notification.model';
import type {
  Notification as NotificationUi,
  NotificationFilter,
} from '@core/models/ui/notification.model';

export interface CreateNotificationPayload {
  recipientId: number;
  type?: 'email' | 'whatsapp' | 'system';
  subject?: string;
  message: string;
  referenceType?: string;
  referenceId?: number;
}

/** Payload sin destinatario — el destinatario lo resuelve `notifyUsers`/`notifyRole`. */
export interface NotifyPayload {
  subject?: string;
  message: string;
  referenceType?: string;
  referenceId?: number;
}

interface UserRoleRow {
  id: number;
  branch_id: number | null;
  roles: { name: string } | Array<{ name: string }> | null;
}

/**
 * NotificationsFacade — Capa 2 del sistema de notificaciones.
 *
 * Notificaciones persistentes en BD + Supabase Realtime.
 * Reemplaza al antiguo `NotificationsService` (mock).
 *
 * Patrón Facade de 3 secciones:
 * 1. Estado privado (signals mutables)
 * 2. Estado público (readonly + computed)
 * 3. Métodos de acción (mutadores)
 */
@Injectable({ providedIn: 'root' })
export class NotificationsFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthFacade);
  private readonly toast = inject(ToastService);

  // ── 1. ESTADO PRIVADO ──────────────────────────────────────────────────────
  private _notifications = signal<NotificationUi[]>([]);
  private _isLoading = signal(false);
  private _error = signal<string | null>(null);
  private _filter = signal<NotificationFilter>('all');
  private realtimeChannel: RealtimeChannel | null = null;

  // ── 2. ESTADO PÚBLICO (readonly) ───────────────────────────────────────────
  readonly notifications = this._notifications.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly filter = this._filter.asReadonly();

  readonly unreadCount = computed(() => this._notifications().filter((n) => !n.read).length);

  private readonly sortedNotifications = computed(() =>
    [...this._notifications()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  );

  readonly filteredNotifications = computed(() => {
    const list = this.sortedNotifications();
    const f = this._filter();
    if (f === 'all') return list;
    if (f === 'unread') return list.filter((n) => !n.read);
    return list.filter((n) => (n.type ?? 'info') === f);
  });

  /** Entradas del panel: agrupa 3+ no leídas del mismo tipo/día (AC8) y corta a 15. */
  readonly panelEntries = computed(() =>
    groupNotifications(this.filteredNotifications()).slice(0, 15),
  );

  // ── 3. MÉTODOS DE ACCIÓN ───────────────────────────────────────────────────

  /**
   * Inicializa el facade: espera autenticación, carga notificaciones y
   * suscribe al canal Realtime para INSERT en `notifications`.
   * Idempotente: si ya hay un canal activo, dispone primero.
   */
  async initialize(): Promise<void> {
    await this.auth.whenReady;

    const user = this.auth.currentUser();
    if (!user?.dbId) return;

    // Idempotencia: limpiar canal previo si existe
    if (this.realtimeChannel) {
      this.dispose();
    }

    await this.loadNotifications();
    this.subscribeRealtime(user.dbId);
  }

  /**
   * Carga las últimas 50 notificaciones del usuario autenticado.
   */
  async loadNotifications(): Promise<void> {
    const dbId = this.auth.currentUser()?.dbId;
    if (!dbId) return;

    this._isLoading.set(true);
    this._error.set(null);

    const { data, error } = await this.supabase.client
      .from('notifications')
      .select('*')
      .eq('recipient_id', dbId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      this._error.set('Error al cargar notificaciones');
      console.error('[NotificationsFacade] loadNotifications error:', error);
    } else {
      this._notifications.set((data as NotificationDto[]).map(mapNotificationDtoToUi));
    }

    this._isLoading.set(false);
  }

  /**
   * Marca una notificación como leída (optimistic update + BD).
   */
  async markAsRead(id: string): Promise<void> {
    // Optimistic update
    this._notifications.update((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));

    const { error } = await this.supabase.client
      .from('notifications')
      .update({ read: true })
      .eq('id', Number(id));

    if (error) {
      console.error('[NotificationsFacade] markAsRead error:', error);
      // Revertir en caso de error
      this._notifications.update((list) =>
        list.map((n) => (n.id === id ? { ...n, read: false } : n)),
      );
    }
  }

  /**
   * Marca todas las notificaciones como leídas (optimistic update + BD).
   */
  async markAllAsRead(): Promise<void> {
    const dbId = this.auth.currentUser()?.dbId;
    if (!dbId) return;

    // Guardar estado previo para rollback
    const prev = this._notifications();

    // Optimistic update
    this._notifications.update((list) => list.map((n) => ({ ...n, read: true })));

    const { error } = await this.supabase.client
      .from('notifications')
      .update({ read: true })
      .eq('recipient_id', dbId)
      .eq('read', false);

    if (error) {
      console.error('[NotificationsFacade] markAllAsRead error:', error);
      this._notifications.set(prev);
    }
  }

  /**
   * Crea una notificación en BD.
   */
  async createNotification(payload: CreateNotificationPayload): Promise<void> {
    const { error } = await this.supabase.client.from('notifications').insert({
      recipient_id: payload.recipientId,
      type: payload.type ?? 'system',
      subject: payload.subject,
      message: payload.message,
      reference_type: payload.referenceType,
      reference_id: payload.referenceId,
      read: false,
      sent_ok: true,
    });

    if (error) {
      console.error('[NotificationsFacade] createNotification error:', error);
    }
  }

  /**
   * Marca varias notificaciones como leídas en un solo UPDATE (optimistic + rollback).
   * Usado por el panel al marcar como leída una fila agrupada (AC8).
   */
  async markManyAsRead(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const idSet = new Set(ids);
    const prev = this._notifications();

    this._notifications.update((list) =>
      list.map((n) => (idSet.has(n.id) ? { ...n, read: true } : n)),
    );

    const { error } = await this.supabase.client
      .from('notifications')
      .update({ read: true })
      .in('id', ids.map(Number));

    if (error) {
      console.error('[NotificationsFacade] markManyAsRead error:', error);
      this._notifications.set(prev);
    }
  }

  /**
   * Inserta una notificación por cada `recipientId` en un solo INSERT batch.
   * Fire-and-forget: un fallo se loguea y jamás rompe al productor (AC-E1).
   */
  async notifyUsers(recipientIds: number[], payload: NotifyPayload): Promise<void> {
    if (recipientIds.length === 0) return;

    const rows = recipientIds.map((recipientId) => ({
      recipient_id: recipientId,
      type: 'system' as const,
      subject: payload.subject,
      message: payload.message,
      reference_type: payload.referenceType,
      reference_id: payload.referenceId,
      read: false,
      sent_ok: true,
    }));

    const { error } = await this.supabase.client.from('notifications').insert(rows);

    if (error) {
      console.error('[NotificationsFacade] notifyUsers error:', error);
    }
  }

  /**
   * Notifica a todos los usuarios activos de un rol (BD: 'admin' | 'secretary'), excluyendo
   * al actor. Para 'secretary' aplica filtro de sede; para 'admin' (branch NULL) no aplica.
   * Sin destinatarios → no-op silencioso (AC-E3).
   */
  async notifyRole(
    role: 'admin' | 'secretary',
    branchId: number | null,
    payload: NotifyPayload,
  ): Promise<void> {
    const actorDbId = this.auth.currentUser()?.dbId ?? null;

    let query = this.supabase.client
      .from('users')
      .select('id, branch_id, roles!role_id(name)')
      .eq('active', true);

    if (actorDbId !== null) {
      query = query.neq('id', actorDbId);
    }
    if (role === 'secretary' && branchId !== null) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[NotificationsFacade] notifyRole query error:', error);
      return;
    }

    const recipientIds = ((data ?? []) as unknown as UserRoleRow[])
      .filter((u) => {
        const roleRow = Array.isArray(u.roles) ? u.roles[0] : u.roles;
        return roleRow?.name === role;
      })
      .map((u) => u.id);

    await this.notifyUsers(recipientIds, payload);
  }

  setFilter(filter: NotificationFilter): void {
    this._filter.set(filter);
  }

  /**
   * Limpia el canal Realtime y resetea estado.
   */
  dispose(): void {
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    this._notifications.set([]);
    this._filter.set('all');
    this._error.set(null);
    this._isLoading.set(false);
  }

  // ── Privado ────────────────────────────────────────────────────────────────

  private subscribeRealtime(dbId: number): void {
    this.realtimeChannel = this.supabase.client
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${dbId}`,
        },
        (payload) => {
          const newNotif = mapNotificationDtoToUi(payload.new as NotificationDto);
          this._notifications.update((list) => [newNotif, ...list]);
          this.toast.info(newNotif.title, newNotif.message);
        },
      )
      .subscribe();
  }
}
