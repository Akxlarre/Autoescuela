import { Injectable, signal, computed } from '@angular/core';

export type ConfirmSeverity = 'danger' | 'warn' | 'success' | 'info' | 'secondary';

/** Campo de motivo obligatorio dentro del modal (spec 0010-i). */
export interface ConfirmReasonConfig {
  label: string;
  placeholder?: string;
  /** Largo mínimo del motivo sin espacios a los costados (default 1). */
  minLength?: number;
}

export interface ConfirmConfig {
  title: string;
  message: string;
  severity?: ConfirmSeverity;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * hotfix-062-b: por defecto el mensaje se muestra como TEXTO (Angular lo escapa y respeta los
   * saltos de línea). `true` lo interpreta como HTML: solo para mensajes armados por código, con
   * todo dato de usuario pasado por `escapeHtml()` (ej. el `<strong>` de "Rematricular").
   */
  allowHtml?: boolean;
  /** Solo lo usa `confirmWithReason()`: muestra un campo de motivo obligatorio. */
  reason?: ConfirmReasonConfig;
}

@Injectable({ providedIn: 'root' })
export class ConfirmModalService {
  private readonly _config = signal<ConfirmConfig | null>(null);
  private readonly _reason = signal('');

  /** Configuración actual del modal (null = cerrado). */
  readonly config = this._config.asReadonly();

  /** Si el modal está visible. */
  readonly isOpen = computed(() => this._config() !== null);

  /** Motivo escrito en el modal (solo en `confirmWithReason()`). */
  readonly reason = this._reason.asReadonly();

  /** Sin campo de motivo siempre es válido; con campo, exige el largo mínimo. */
  readonly reasonValid = computed(() => {
    const reason = this._config()?.reason;
    if (!reason) return true;
    return this._reason().trim().length >= (reason.minLength ?? 1);
  });

  private resolvePromise: ((value: boolean) => void) | null = null;

  /**
   * Muestra el modal de confirmación y devuelve una promesa que se resuelve
   * con true si el usuario confirma, false si cancela.
   */
  confirm(config: ConfirmConfig): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.resolvePromise = resolve;
      this.open({ ...config, reason: undefined });
    });
  }

  /**
   * Spec 0010-i: como `confirm()`, pero con un motivo obligatorio. Resuelve con el motivo (sin
   * espacios a los costados) si confirma, o null si cancela.
   */
  confirmWithReason(
    config: ConfirmConfig & { reason: ConfirmReasonConfig },
  ): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      this.resolvePromise = (ok) => resolve(ok ? this._reason().trim() : null);
      this.open(config);
    });
  }

  setReason(value: string): void {
    this._reason.set(value);
  }

  /** Resuelve con true (confirmado). Con motivo, no hace nada hasta que el motivo sea válido. */
  accept(): void {
    if (!this.reasonValid()) return;
    this.resolvePromise?.(true);
    this.close();
  }

  /** Resuelve con false (cancelado). */
  cancel(): void {
    this.resolvePromise?.(false);
    this.close();
  }

  private open(config: ConfirmConfig): void {
    this._reason.set('');
    this._config.set({
      title: config.title,
      message: config.message,
      severity: config.severity ?? 'secondary',
      confirmLabel: config.confirmLabel ?? 'Aceptar',
      cancelLabel: config.cancelLabel ?? 'Cancelar',
      allowHtml: config.allowHtml ?? false,
      reason: config.reason,
    });
  }

  private close(): void {
    this.resolvePromise = null;
    this._config.set(null);
    this._reason.set('');
  }
}
