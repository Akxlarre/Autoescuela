import { Injectable, computed, inject, Type } from '@angular/core';
import { LayoutDrawerService } from './layout-drawer.service';

/**
 * LayoutDrawerFacadeService — Interfaz pública para componentes UI.
 * Expone señales de solo lectura y métodos de acción hacia LayoutDrawerService.
 * Requisito de arquitectura: Componentes usan Facades, nunca Services directamente.
 */
@Injectable({
  providedIn: 'root',
})
export class LayoutDrawerFacadeService {
  private readonly layoutDrawer = inject(LayoutDrawerService);

  readonly isOpen = this.layoutDrawer.isOpen;
  readonly component = this.layoutDrawer.component;
  readonly title = this.layoutDrawer.title;
  readonly icon = this.layoutDrawer.icon;
  readonly actions = this.layoutDrawer.actions;
  readonly canGoBack = this.layoutDrawer.canGoBack;

  open(component: Type<any>, title: string, icon?: string, actions?: any[]): void {
    this.layoutDrawer.open(component, title, icon, actions);
  }

  /** Navega a un nuevo componente dentro del drawer sin cerrarlo. */
  push(component: Type<any>, title: string, icon?: string): void {
    this.layoutDrawer.push(component, title, icon);
  }

  /** Regresa al componente anterior (o cierra si no hay historial). */
  back(): void {
    this.layoutDrawer.back();
  }

  setActions(actions: any[]): void {
    this.layoutDrawer.setActions(actions);
  }

  close(): void {
    this.layoutDrawer.close();
  }
}
