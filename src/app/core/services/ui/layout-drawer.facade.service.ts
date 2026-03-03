import { Injectable, computed, inject, Type } from '@angular/core';
import { LayoutDrawerService } from './layout-drawer.service';

/**
 * LayoutDrawerFacadeService — Interfaz pública para componentes UI.
 * Expone señales de solo lectura y métodos de acción hacia LayoutDrawerService.
 * Requisito de arquitectura: Componentes usan Facades, nunca Services directamente.
 */
@Injectable({
    providedIn: 'root'
})
export class LayoutDrawerFacadeService {
    private readonly layoutDrawer = inject(LayoutDrawerService);

    readonly isOpen = this.layoutDrawer.isOpen;
    readonly component = this.layoutDrawer.component;
    readonly title = this.layoutDrawer.title;
    readonly icon = this.layoutDrawer.icon;

    open(component: Type<any>, title: string, icon?: string): void {
        this.layoutDrawer.open(component, title, icon);
    }

    close(): void {
        this.layoutDrawer.close();
    }
}
