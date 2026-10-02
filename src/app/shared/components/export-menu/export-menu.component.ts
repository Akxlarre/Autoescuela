import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { StableWidthDirective } from '@core/directives/stable-width.directive';

export type ExportFormat = 'excel' | 'pdf';

/**
 * Botón "Exportar" con menú Excel / PDF (spec 0021-m).
 *
 * Dumb: solo avisa qué formato se eligió; quién genera el archivo es el Facade del dominio.
 * Mismo diseño que el menú de app-alumnos-list-content, extraído para no copiarlo otra vez.
 */
@Component({
  selector: 'app-export-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, StableWidthDirective],
  template: `
    <div class="relative">
      <button
        type="button"
        class="btn-secondary flex items-center justify-center gap-2 disabled:opacity-60"
        [disabled]="exporting() || disabled()"
        [appStableWidth]="exporting()"
        (click)="open.set(!open())"
        [attr.aria-expanded]="open()"
        aria-haspopup="menu"
        data-llm-action="open-export-menu"
      >
        @if (exporting()) {
          <app-icon name="loader-circle" [size]="16" class="animate-spin" />
        } @else {
          <app-icon name="download" [size]="16" />
        }
        Exportar
        <app-icon name="chevron-down" [size]="14" />
      </button>
      @if (open()) {
        <div class="fixed inset-0 z-10" (click)="open.set(false)"></div>
        <div class="export-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            class="export-menu-item"
            (click)="choose('excel')"
            [attr.data-llm-action]="'export-' + llmSubject() + '-excel'"
          >
            <app-icon name="table-2" [size]="16" />
            Exportar como Excel
          </button>
          <button
            type="button"
            role="menuitem"
            class="export-menu-item"
            (click)="choose('pdf')"
            [attr.data-llm-action]="'export-' + llmSubject() + '-pdf'"
          >
            <app-icon name="file-text" [size]="16" />
            Exportar como PDF
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .export-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      z-index: 20;
      min-width: 200px;
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
    }

    .export-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 10px 14px;
      font-size: 13px;
      color: var(--text-primary);
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
      transition: background var(--duration-fast);
    }

    .export-menu-item:hover {
      background: var(--bg-elevated);
    }
  `,
})
export class ExportMenuComponent {
  /** Hay una exportación en curso: muestra el spinner y bloquea el botón. */
  readonly exporting = input(false);
  /** No hay nada que exportar (lista vacía). */
  readonly disabled = input(false);
  /** Qué se exporta, para los data-llm-action de las opciones (ej. "students" → export-students-excel). */
  readonly llmSubject = input.required<string>();

  readonly exportRequested = output<ExportFormat>();

  protected readonly open = signal(false);

  protected choose(format: ExportFormat): void {
    this.open.set(false);
    this.exportRequested.emit(format);
  }
}
