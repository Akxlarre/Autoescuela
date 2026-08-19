import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { IconComponent } from '@shared/components/icon/icon.component';
import {
  PRIVACY_POLICY_VERSION,
  getPrivacyPolicy,
  type PolicyBlock,
} from '@core/models/ui/privacy-policy.model';

/**
 * PoliticaPrivacidadComponent — Política de Privacidad pública (spec 0009-m, AC2).
 *
 * Ruta `/politica-privacidad/:branchSlug`, **fuera del shell autenticado**: el titular
 * tiene que poder leerla antes de tener cuenta, y de hecho antes de decidir si entrega
 * sus datos. Sin guard, sin sesión, sin sidebar.
 *
 * Hay **una política por sociedad**, no una genérica: `Autoescuela Chillán` y
 * `Conductores Chillán` son dos responsables distintos que responden por separado ante
 * la Agencia de Protección de Datos Personales, y la política es la declaración de **un**
 * responsable identificado sobre **su** tratamiento.
 *
 * No usa `.bento-grid`: es un documento legal para leer e imprimir, no una vista de
 * navegación — la excepción "no es una vista de navegación normal" de `visual-system.md`.
 */
@Component({
  selector: 'app-politica-privacidad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  template: `
    <main class="min-h-screen bg-base py-10 px-4">
      <div class="mx-auto max-w-3xl">
        @if (policy(); as p) {
          <header class="mb-8">
            <h1 class="text-2xl font-bold text-text-primary mb-2">Política de Privacidad</h1>
            <p class="text-base text-text-secondary">{{ p.legalName }}</p>
            <p class="micro-label mt-4">Última actualización: {{ p.lastUpdated }}</p>
            <p class="micro-label">Entrada en vigencia: {{ p.effectiveFrom }}</p>
            <p class="micro-label">Versión: {{ version }}</p>
          </header>

          <div class="card mb-8">
            <dl class="grid gap-2 text-sm">
              <div class="flex flex-wrap gap-2">
                <dt class="micro-label">Responsable</dt>
                <dd class="text-text-primary m-0">{{ p.legalName }}</dd>
              </div>
              <div class="flex flex-wrap gap-2">
                <dt class="micro-label">RUT</dt>
                <dd class="text-text-primary m-0">{{ p.rut }}</dd>
              </div>
              <div class="flex flex-wrap gap-2">
                <dt class="micro-label">Domicilio</dt>
                <dd class="text-text-primary m-0">{{ p.address }}</dd>
              </div>
              <div class="flex flex-wrap gap-2">
                <dt class="micro-label">Giro</dt>
                <dd class="text-text-primary m-0">{{ p.businessLine }}</dd>
              </div>
              <div class="flex flex-wrap gap-2">
                <dt class="micro-label">Canal de derechos</dt>
                <dd class="m-0">
                  <a [href]="'mailto:' + p.rightsEmail" class="underline text-brand">{{
                    p.rightsEmail
                  }}</a>
                </dd>
              </div>
            </dl>
          </div>

          @for (section of p.sections; track section.heading) {
            <section class="mb-8">
              <h2 class="text-lg font-bold text-text-primary mb-3">{{ section.heading }}</h2>

              @for (block of section.blocks; track $index) {
                @switch (block.kind) {
                  @case ('paragraph') {
                    <p class="text-sm text-text-secondary leading-relaxed mb-3">
                      {{ asParagraph(block).text }}
                    </p>
                  }
                  @case ('list') {
                    <ul class="list-disc pl-5 mb-3 space-y-1.5">
                      @for (item of asList(block).items; track $index) {
                        <li class="text-sm text-text-secondary leading-relaxed">{{ item }}</li>
                      }
                    </ul>
                  }
                  @case ('table') {
                    <!-- Contenido ancho: scrollea dentro de su caja, la página nunca en horizontal. -->
                    <div class="overflow-x-auto mb-3">
                      <table class="w-full text-sm border-collapse">
                        <thead>
                          <tr>
                            @for (h of asTable(block).headers; track $index) {
                              <th
                                class="micro-label text-left align-top p-2 border-b border-border-default"
                              >
                                {{ h }}
                              </th>
                            }
                          </tr>
                        </thead>
                        <tbody>
                          @for (row of asTable(block).rows; track $index) {
                            <tr>
                              @for (cell of row; track $index) {
                                <td
                                  class="text-text-secondary align-top p-2 border-b border-border-subtle leading-relaxed"
                                >
                                  {{ cell }}
                                </td>
                              }
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                }
              }
            </section>
          }

          <footer class="pt-6 border-t border-border-subtle">
            <p class="text-xs text-text-muted">
              Documento preparado sobre la base del texto vigente de la Ley 21.719.
            </p>
          </footer>
        } @else {
          <!-- Slug inexistente: mensaje claro, no una pantalla en blanco. -->
          <div class="card flex flex-col items-center text-center gap-3 py-10">
            <app-icon name="file-question" [size]="32" color="var(--text-muted)" />
            <h1 class="text-lg font-bold text-text-primary m-0">
              No encontramos esa política de privacidad
            </h1>
            <p class="text-sm text-text-secondary m-0">
              El enlace puede estar incompleto. Cada sede tiene la suya.
            </p>
            <div class="flex flex-wrap gap-3 justify-center mt-2">
              @for (slug of knownSlugs; track slug.slug) {
                <a
                  [routerLink]="['/politica-privacidad', slug.slug]"
                  class="btn-secondary"
                  data-llm-nav="politica-privacidad-alternativa"
                  >{{ slug.name }}</a
                >
              }
            </div>
          </div>
        }
      </div>
    </main>
  `,
})
export class PoliticaPrivacidadComponent {
  private readonly route = inject(ActivatedRoute);

  readonly version = PRIVACY_POLICY_VERSION;

  private readonly branchSlug = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('branchSlug') ?? '')),
    { initialValue: '' },
  );

  readonly policy = computed(() => getPrivacyPolicy(this.branchSlug()));

  /** Alternativas que se le ofrecen a quien llega con un slug inválido. */
  readonly knownSlugs = [
    { slug: 'conductores-chillan', name: 'Conductores Chillán' },
    { slug: 'autoescuela-chillan', name: 'Autoescuela Chillán' },
  ];

  // El `@switch` sobre `block.kind` no estrecha el tipo dentro del template, así que el
  // narrowing se hace acá — sin `any`, y sin duplicar la unión en cada rama.
  protected asParagraph(b: PolicyBlock) {
    return b as Extract<PolicyBlock, { kind: 'paragraph' }>;
  }
  protected asList(b: PolicyBlock) {
    return b as Extract<PolicyBlock, { kind: 'list' }>;
  }
  protected asTable(b: PolicyBlock) {
    return b as Extract<PolicyBlock, { kind: 'table' }>;
  }
}
