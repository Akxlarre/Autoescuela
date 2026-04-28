import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  AfterViewInit,
  ElementRef,
  viewChild,
} from '@angular/core';
import { input, output } from '@angular/core';

import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { BranchOption } from '@core/models/ui/branch.model';

/**
 * BranchGateComponent — Pantalla de selección de sede.
 *
 * Se muestra cuando una vista requiere una sede concreta y el admin aún
 * no ha elegido ninguna (selectedBranchId === null). Reemplaza el auto-select
 * silencioso del BranchFacade por una elección explícita y visible.
 *
 * Dumb: solo input/output. Sin inyección de BranchFacade.
 *
 * Uso:
 *   <app-branch-gate
 *     [branches]="branchFacade.branches()"
 *     reason="El wizard requiere una sede concreta."
 *     (branchSelected)="branchFacade.selectBranch($event)"
 *   />
 *
 * Con professionalOnly=true, solo muestra sedes con hasProfessional=true.
 */
@Component({
  selector: 'app-branch-gate',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="branch-gate" #gateRef>
      <!-- Icono + título + subtítulo -->
      <div class="branch-gate__header">
        <div class="branch-gate__icon-wrap">
          <app-icon name="building-2" [size]="28" [ariaHidden]="true" />
        </div>
        <h2 class="branch-gate__title">Selecciona una sede</h2>
        <p class="branch-gate__subtitle">{{ reason() }}</p>
      </div>

      <!-- Cards de sedes -->
      <div class="branch-gate__grid" role="listbox" aria-label="Seleccionar sede">
        @for (branch of visibleBranches(); track branch.id; let first = $first) {
          <button
            type="button"
            role="option"
            class="branch-gate__card card"
            [class.card-accent]="first"
            [attr.aria-label]="'Seleccionar sede ' + branch.name"
            [attr.data-llm-action]="'gate-select-branch-' + branch.slug"
            (click)="select(branch.id)"
          >
            <span class="branch-gate__card-icon">
              <app-icon name="building-2" [size]="20" [ariaHidden]="true" />
            </span>
            <span class="branch-gate__card-body">
              <span class="branch-gate__card-name">{{ branch.name }}</span>
              @if (branch.hasProfessional) {
                <span class="branch-gate__card-badge">Clase Profesional</span>
              }
            </span>
            <app-icon
              name="arrow-right"
              [size]="16"
              class="branch-gate__card-arrow"
              [ariaHidden]="true"
            />
          </button>
        }

        @if (visibleBranches().length === 0) {
          <p class="branch-gate__empty">No hay sedes disponibles para esta vista.</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .branch-gate {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2rem;
        padding: 2rem 1rem;
        width: 100%;
      }

      /* ── Header ──────────────────────────────────────────────── */
      .branch-gate__header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        text-align: center;
        max-width: 400px;
      }

      .branch-gate__icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        border-radius: var(--radius-full);
        background: var(--color-primary-muted);
        color: var(--color-primary);
        margin-bottom: 0.25rem;
      }

      .branch-gate__title {
        font-size: var(--text-xl);
        font-weight: var(--font-bold);
        color: var(--text-primary);
        font-family: var(--font-heading);
        margin: 0;
      }

      .branch-gate__subtitle {
        font-size: var(--text-sm);
        color: var(--text-secondary);
        margin: 0;
        line-height: 1.5;
      }

      /* ── Grid de sedes ───────────────────────────────────────── */
      .branch-gate__grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.75rem;
        width: 100%;
        max-width: 480px;
      }

      @media (min-width: 480px) {
        .branch-gate__grid {
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }
      }

      /* ── Card de sede ────────────────────────────────────────── */
      .branch-gate__card {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.25rem;
        border: none;
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
        cursor: pointer;
        text-align: left;
        font-family: var(--font-body);
        transition:
          transform var(--duration-fast) var(--ease-standard),
          box-shadow var(--duration-fast) var(--ease-standard),
          background var(--duration-fast) var(--ease-standard);
      }

      .branch-gate__card:hover {
        background: var(--bg-elevated);
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }

      .branch-gate__card:active {
        transform: translateY(0);
      }

      .branch-gate__card-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-md);
        background: var(--color-primary-muted);
        color: var(--color-primary);
        flex-shrink: 0;
      }

      .branch-gate__card-body {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-width: 0;
      }

      .branch-gate__card-name {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .branch-gate__card-badge {
        font-size: 10px;
        font-weight: var(--font-medium);
        color: var(--color-primary);
        background: var(--color-primary-muted);
        border-radius: var(--radius-sm);
        padding: 1px 6px;
        width: fit-content;
      }

      .branch-gate__card-arrow {
        flex-shrink: 0;
        color: var(--text-muted);
        transition: transform var(--duration-fast) var(--ease-standard);
      }

      .branch-gate__card:hover .branch-gate__card-arrow {
        transform: translateX(3px);
        color: var(--color-primary);
      }

      /* ── Estado vacío ────────────────────────────────────────── */
      .branch-gate__empty {
        font-size: var(--text-sm);
        color: var(--text-muted);
        text-align: center;
        padding: 1rem;
      }
    `,
  ],
})
export class BranchGateComponent implements AfterViewInit {
  readonly branches = input.required<BranchOption[]>();
  /** Texto explicativo que se muestra como subtítulo de la gate. */
  readonly reason = input('Esta vista requiere una sede específica para operar.');
  /** Si true, solo muestra sedes con hasProfessional=true. */
  readonly professionalOnly = input(false);

  readonly branchSelected = output<number>();

  protected readonly visibleBranches = computed(() => {
    const all = this.branches();
    return this.professionalOnly() ? all.filter((b) => b.hasProfessional) : all;
  });

  private readonly gsap = inject(GsapAnimationsService);
  private readonly gateRef = viewChild<ElementRef<HTMLElement>>('gateRef');

  ngAfterViewInit(): void {
    const el = this.gateRef()?.nativeElement;
    if (el) this.gsap.animateBentoGrid(el);
  }

  protected select(id: number): void {
    this.branchSelected.emit(id);
  }
}
