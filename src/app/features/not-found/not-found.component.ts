import { Component, ChangeDetectionStrategy } from "@angular/core";
import { RouterLink } from "@angular/router";

/**
 * NotFoundComponent — Página 404 genérica.
 *
 * Se muestra cuando el usuario navega a una ruta inexistente.
 * Usa design tokens del sistema, compatible con light/dark mode.
 */
@Component({
  selector: "app-not-found",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="flex min-h-[100dvh] items-center justify-center bg-base p-4">
      <div class="max-w-[400px] text-center">
        <span
          class="bg-[image:var(--gradient-hero)] bg-clip-text font-display text-[6rem] font-bold leading-none text-transparent"
          >404</span
        >
        <h1 class="my-4 mb-2 font-display text-2xl font-bold text-text-primary">
          Página no encontrada
        </h1>
        <p class="m-0 mb-6 text-base text-text-muted">
          La ruta que buscas no existe o fue movida.
        </p>
        <a
          routerLink="/app"
          data-llm-nav="/app"
          class="inline-flex cursor-pointer items-center justify-center rounded-[var(--btn-primary-radius)] border-none bg-[var(--btn-primary-bg)] px-[var(--btn-primary-padding-x)] py-[var(--btn-primary-padding-y)] font-body text-sm font-semibold text-[var(--btn-primary-text)] no-underline shadow-[var(--btn-primary-shadow)] transition-[var(--transition-btn)] hover:bg-[var(--btn-primary-bg-hover)] hover:shadow-[var(--btn-primary-shadow-hover)] active:scale-[var(--btn-press-scale-value)]"
        >
          Volver al inicio
        </a>
      </div>
    </div>
  `,
  host: { style: "display: contents;" },
})
export class NotFoundComponent {}
