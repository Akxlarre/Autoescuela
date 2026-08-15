import { Component, ChangeDetectionStrategy, input } from '@angular/core';

/**
 * LogoComponent — Muestra el nombre de marca/sede en el sidebar.
 *
 * Dumb puro (fix-146-b): recibe el texto ya resuelto vía `input()`. Antes inyectaba
 * `AuthFacade` + `BranchFacade` para calcularlo él mismo, violando la separación
 * Smart/Dumb — es un componente presentacional que renderiza un único string, no un
 * organismo de dominio. La decisión de qué sede mostrar vive ahora en
 * `resolveBrandText()` (`core/utils/brand-text.utils.ts`), y la inyección de Facades
 * en `SidebarComponent` (`layout/`, autorizado a hacerlo).
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center text-center w-full">
      <span class="font-display text-xl font-bold text-brand leading-tight">
        {{ brandText() }}
      </span>
    </div>
  `,
  host: {
    class: 'block',
  },
})
export class LogoComponent {
  /** Texto de marca ya resuelto por el padre (ej. "Autoescuela Chillán"). */
  readonly brandText = input.required<string>();
}
