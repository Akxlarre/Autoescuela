import { Directive, inject } from "@angular/core";
import { SearchPanelService } from "@core/services/search-panel.service";

/**
 * Atajo global Ctrl+K / Cmd+K para abrir el panel de búsqueda.
 * Aplicar en el componente raíz (app-root).
 */
@Directive({
  selector: "[appSearchShortcut]",
  standalone: true,
  host: { "(document:keydown)": "onKeyDown($event)" },
})
export class SearchShortcutDirective {
  private readonly searchPanel = inject(SearchPanelService);

  onKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === "k") {
      event.preventDefault();
      this.searchPanel.open();
    }
  }
}
