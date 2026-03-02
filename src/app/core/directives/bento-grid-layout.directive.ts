import { Directive, ElementRef, inject, InjectionToken } from '@angular/core';
import { GsapAnimationsService } from '@core/services/gsap-animations.service';

/**
 * Contexto para que hijos de un bento-grid disparen animaciones de reflow.
 * Inyectar opcionalmente en componentes que cambien su tamaño.
 */
export interface BentoGridLayoutContext {
    /** Ejecuta el callback dentro de una animación FLIP (posición + tamaño). */
    runLayoutChange(onChange: () => void, onComplete?: () => void): void;
}

export const BENTO_GRID_LAYOUT_CONTEXT = new InjectionToken<BentoGridLayoutContext>(
    'BentoGridLayoutContext'
);

/**
 * Directiva para bento-grid. Proporciona BentoGridLayoutContext a los hijos.
 * Los componentes que cambien su tamaño pueden inyectar el contexto y llamar
 * runLayoutChange(callback) para animar el reflow.
 *
 * Uso: inject(BENTO_GRID_LAYOUT_CONTEXT, { optional: true }) y llamar
 * runLayoutChange(() => aplicarCambio()) cuando el hijo cambie su tamaño.
 */
@Directive({
    selector: '[appBentoGridLayout]',
    standalone: true,
    providers: [
        {
            provide: BENTO_GRID_LAYOUT_CONTEXT,
            useFactory: (dir: BentoGridLayoutDirective) => ({
                runLayoutChange: (onChange: () => void, onComplete?: () => void) => {
                    dir.runLayoutChange(onChange, onComplete);
                },
            }),
            deps: [BentoGridLayoutDirective],
        },
    ],
})
export class BentoGridLayoutDirective {
    private el = inject(ElementRef<HTMLElement>);
    private gsap = inject(GsapAnimationsService);

    runLayoutChange(onChange: () => void, onComplete?: () => void): void {
        this.gsap.animateBentoLayoutChange(this.el.nativeElement, onChange, onComplete);
    }
}
