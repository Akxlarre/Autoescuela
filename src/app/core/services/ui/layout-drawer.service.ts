import { Injectable, signal, computed, Type, inject } from '@angular/core';

export interface LayoutDrawerAction {
  label: string;
  icon: string;
  callback: () => void;
  llmAction?: string;
}

export interface LayoutDrawerState {
  isOpen: boolean;
  component: Type<any> | null;
  title: string;
  icon?: string;
  actions?: LayoutDrawerAction[];
}

/**
 * LayoutDrawerService - Orquesta el Drawer arquitectónico del AppShell.
 *
 * Este panel coexiste con el <main> principal y desplaza el layout.
 * Permite renderizado dinámico de componentes y previene flickering en el cierre
 * esperando a que termine la animación antes de limpiar el NgComponentOutlet.
 *
 * Soporta navegación en pila (push/back) para sub-vistas dentro del mismo drawer
 * sin cerrar y reabrir el panel (útil cuando un componente hijo necesita abrir
 * otro sin perder el contexto del padre, ej: Agenda → Agendar clase).
 */
@Injectable({
  providedIn: 'root',
})
export class LayoutDrawerService {
  private _state = signal<LayoutDrawerState>({
    isOpen: false,
    component: null,
    title: '',
    icon: undefined,
    actions: [],
  });

  /** Historial de estados anteriores para navegación back. */
  private _history = signal<LayoutDrawerState[]>([]);

  // Selectors
  readonly state = this._state.asReadonly();
  readonly isOpen = computed(() => this._state().isOpen);
  readonly component = computed(() => this._state().component);
  readonly title = computed(() => this._state().title);
  readonly icon = computed(() => this._state().icon);
  readonly actions = computed(() => this._state().actions ?? []);
  /** True cuando hay un estado previo al que se puede volver (back). */
  readonly canGoBack = computed(() => this._history().length > 0);

  /**
   * Abre el drawer arquitectónico inyectando un componente dinámico.
   * Limpia el historial previo (entrada de nivel raíz).
   */
  open(component: Type<any>, title: string, icon?: string, actions?: LayoutDrawerAction[]): void {
    this._history.set([]);
    this._state.set({ isOpen: true, component, title, icon, actions });
  }

  /**
   * Navega a un nuevo componente DENTRO del drawer ya abierto.
   * Guarda el estado actual en el historial para poder volver con back().
   * Si el drawer está cerrado, actúa igual que open().
   */
  push(component: Type<any>, title: string, icon?: string): void {
    if (this._state().isOpen && this._state().component !== null) {
      this._history.update((h) => [...h, { ...this._state() }]);
      this._state.update((s) => ({ ...s, component, title, icon, actions: [] }));
    } else {
      this.open(component, title, icon);
    }
  }

  /**
   * Regresa al estado anterior del historial.
   * Si no hay historial, cierra el drawer.
   */
  back(): void {
    const history = this._history();
    if (history.length > 0) {
      const prev = history[history.length - 1];
      this._history.update((h) => h.slice(0, -1));
      this._state.set(prev);
    } else {
      this.close();
    }
  }

  /**
   * Actualiza las acciones del header dinámicamente si el componente ya está abierto.
   */
  setActions(actions: LayoutDrawerAction[]): void {
    this._state.update((s) => ({ ...s, actions }));
  }

  /**
   * Comienza la secuencia de cierre y limpia el historial.
   * IMPORTANTE: No limpia el componente inmediatamente. El LayoutDrawerComponent
   * es responsable de esperar a GSAP y luego llamar a `clear()`.
   */
  close(): void {
    this._history.set([]);
    this._state.update((s) => ({ ...s, isOpen: false }));
  }

  /**
   * Destruye el componente renderizado (llamado DESPUÉS de la salida GSAP).
   */
  clear(): void {
    this._state.update((s) => ({
      ...s,
      component: null,
      title: '',
      icon: undefined,
      actions: [],
    }));
  }
}
