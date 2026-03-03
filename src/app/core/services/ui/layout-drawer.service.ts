import { Injectable, signal, computed, Type, inject } from '@angular/core';

export interface LayoutDrawerState {
    isOpen: boolean;
    component: Type<any> | null;
    title: string;
    icon?: string;
}

/**
 * LayoutDrawerService - Orquesta el Drawer arquitectónico del AppShell.
 * 
 * Este panel coexiste con el <main> principal y desplaza el layout.
 * Permite renderizado dinámico de componentes y previene flickering en el cierre
 * esperando a que termine la animación antes de limpiar el NgComponentOutlet.
 */
@Injectable({
    providedIn: 'root'
})
export class LayoutDrawerService {
    private _state = signal<LayoutDrawerState>({
        isOpen: false,
        component: null,
        title: '',
        icon: undefined
    });

    // Selectors
    readonly state = this._state.asReadonly();
    readonly isOpen = computed(() => this._state().isOpen);
    readonly component = computed(() => this._state().component);
    readonly title = computed(() => this._state().title);
    readonly icon = computed(() => this._state().icon);

    /**
     * Abre el drawer arquitectónico inyectando un componente dinámico.
     */
    open(component: Type<any>, title: string, icon?: string): void {
        this._state.set({
            isOpen: true,
            component,
            title,
            icon
        });
    }

    /**
     * Comienza la secuencia de cierre.
     * IMPORTANTE: No limpia el componente inmediatamente. El LayoutDrawerComponent
     * es responsable de esperar a GSAP y luego llamar a `clear()` para destruir la vista.
     */
    close(): void {
        this._state.update(s => ({ ...s, isOpen: false }));
    }

    /**
     * Destruye el componente renderizado (llamado DESPUÉS de la salida GSAP).
     */
    clear(): void {
        this._state.update(s => ({ ...s, component: null, title: '', icon: undefined }));
    }
}
