import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-admin-matricula',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6">
      <div class="flex items-center gap-3 mb-6">
        <div>
          <h1 class="text-2xl font-semibold text-text-primary">Nueva Matrícula</h1>
          <p class="text-sm text-text-muted mt-0.5">Mockup: /admin/matricula</p>
        </div>
        <span
          class="ml-auto text-xs font-semibold px-2 py-1 rounded-full bg-surface"
          style="color: var(--state-warning); outline: 1px solid var(--state-warning)"
        >
          PLANO
        </span>
      </div>
      <div
        class="card p-8 flex flex-col items-center justify-center gap-2 text-center"
        style="border-style: dashed"
      >
        <p class="text-text-muted text-sm">Pendiente calcar desde mockup</p>
        <code class="text-xs" style="color: var(--text-muted)">
          mockup/web/src/pages/admin/matricula.astro
        </code>
      </div>
    </div>
  `,
})
export class AdminMatriculaComponent {}
