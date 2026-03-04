import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * GsapAnimationsService - Centralized GSAP animation patterns
 *
 * All motion in the app uses this service. No @angular/animations or CSS @keyframes.
 *
 * Key rules:
 * - Always use clearProps: 'transform' after movement animations
 * - Register plugins ONLY in browser context
 * - Use will-change carefully for performance
 * - Respect prefers-reduced-motion
 */
@Injectable({
  providedIn: 'root',
})
export class GsapAnimationsService {
  private platformId = inject(PLATFORM_ID);
  private prefersReducedMotion = false;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      gsap.registerPlugin(ScrollTrigger);

      // Check user's motion preference
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.prefersReducedMotion = mediaQuery.matches;

      // Listen for changes
      mediaQuery.addEventListener('change', (e) => {
        this.prefersReducedMotion = e.matches;
      });
    }
  }

  /**
   * Animación de entrada para celdas bento — stagger desde abajo.
   * Todas las celdas (incl. hero) usan la misma animación.
   * @param containerEl - Elemento contenedor del bento-grid
   */
  animateBentoGrid(containerEl: HTMLElement): void {
    const cells = Array.from(containerEl.children) as HTMLElement[];

    if (!this.shouldAnimate()) {
      gsap.set(cells, { opacity: 1, y: 0, scale: 1 });
      return;
    }

    gsap.fromTo(
      cells,
      { opacity: 0, y: 24, scale: 0.97 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.55,
        ease: 'power3.out',
        stagger: { amount: 0.25, from: 'start' },
        clearProps: 'transform',
      },
    );
  }

  /**
   * Animación del hero card — entrada con blur + scale
   * @param el - Elemento hero
   */
  animateHero(el: HTMLElement): void {
    if (!this.shouldAnimate()) {
      gsap.set(el, { opacity: 1 });
      return;
    }

    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.95, filter: 'blur(8px)' },
      {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)',
        duration: 0.7,
        ease: 'expo.out',
        clearProps: 'filter,transform',
      },
    );
  }

  /**
   * Números KPI — counter animado
   * @param el - Elemento que mostrará el número
   * @param target - Valor objetivo
   * @param suffix - Sufijo opcional (ej: '%', 'hrs')
   */
  animateCounter(el: HTMLElement, target: number, suffix = ''): void {
    if (!this.shouldAnimate()) {
      el.textContent = Math.round(target) + suffix;
      return;
    }

    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 1.2,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = Math.round(obj.val) + suffix;
      },
    });
  }

  /**
   * Shimmer Effect — Animación de brillo para skeletons.
   * Crea un timeline infinito que desliza un gradiente.
   * @param el - El elemento que actuará como máscara para el brillo
   * @returns Un timeline de GSAP para control manual si es necesario
   */
  createShimmer(el: HTMLElement): gsap.core.Timeline {
    // Si ya tiene un shimmer, no crear otro
    if (el.dataset['gsapShimmer'] === 'true') return gsap.timeline();
    el.dataset['gsapShimmer'] = 'true';

    // Asegurar que el elemento tenga la estructura necesaria
    // El brillo es un pseudo-elemento o un div absoluto hijo
    let shimmerEl = el.querySelector('.gsap-shimmer') as HTMLElement;
    if (!shimmerEl) {
      shimmerEl = document.createElement('div');
      shimmerEl.className = 'gsap-shimmer pointer-events-none absolute inset-0 z-10';

      // UX/UI Improvement: Wider shimmer (150%) for a softer, more elegant sweep
      shimmerEl.style.width = '150%';
      // 105deg angle gives a subtle, premium directional flow compared to rigid 90deg
      shimmerEl.style.background = 'linear-gradient(105deg, transparent 0%, var(--shimmer-highlight, rgba(255,255,255,0.2)) 50%, transparent 100%)';
      shimmerEl.style.transform = 'translateX(-150%)';

      el.classList.add('relative', 'overflow-hidden');
      el.appendChild(shimmerEl);
    }

    const tl = gsap.timeline({ repeat: -1 });

    if (!this.shouldAnimate()) {
      gsap.set(shimmerEl, { display: 'none' });
      return tl;
    }

    tl.to(shimmerEl, {
      x: '100%',
      // Slightly slower duration to match the wider sweep
      duration: 1.8,
      ease: 'none',
      repeatDelay: 0.4,
    });

    return tl;
  }

  /**
   * Hover en cards — sombra elevada sobre fondo claro.
   * Usa tokens del design system (white-labeling).
   * @param el - Elemento card
   */
  addCardHover(el: HTMLElement): void {
    if (!this.shouldAnimate()) return;

    const getToken = (name: string): string => {
      if (typeof document === 'undefined') return '';
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '';
    };

    const enter = () =>
      gsap.to(el, {
        boxShadow: getToken('--card-shadow-hover') || getToken('--shadow-lg'),
        borderColor: getToken('--border-strong') || getToken('--border-default'),
        y: -2,
        duration: 0.22,
        ease: 'power2.out',
      });

    const leave = () =>
      gsap.to(el, {
        boxShadow: getToken('--card-shadow') || getToken('--shadow-md'),
        borderColor: getToken('--border-default') || getToken('--border-subtle'),
        y: 0,
        duration: 0.32,
        ease: 'power2.inOut',
        clearProps: 'boxShadow,borderColor,transform',
      });

    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
  }

  /**
   * Hover en botones — elevación sutil
   * @param el - Elemento button
   */
  addButtonHover(el: HTMLElement): void {
    if (!this.shouldAnimate()) return;

    const enter = () =>
      gsap.to(el, {
        y: -1,
        scale: 1.02,
        duration: 0.2,
        ease: 'power2.out',
      });

    const leave = () =>
      gsap.to(el, {
        y: 0,
        scale: 1,
        duration: 0.25,
        ease: 'power2.inOut',
      });

    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
  }

  /**
   * Transición de cambio de tema — swap inmediato.
   *
   * El cambio visual suave se delega a CSS transitions en body:
   *   transition: background-color, color, border-color (220ms)
   *
   * No se usa View Transitions API para tema porque:
   * - CSS transitions ya proveen suavidad suficiente
   * - Es más robusto cross-browser
   * - Evita glitches en toggles rápidos
   *
   * @param onSwap - Callback que aplica el cambio de tema (data-mode, signals, etc.)
   * @param _origin - No usado. Mantenido por compatibilidad con ThemeService.
   */
  animateThemeChange(onSwap: () => void, _origin?: { x: number; y: number }): Promise<void> {
    onSwap();
    return Promise.resolve();
  }

  /**
   * Animación del icono sol/luna al cambiar tema — feedback inmediato.
   * Scale bounce + rotación solo en el SVG del icono (no en el botón/gradiente).
   * @param btnOrContainer - Botón o contenedor que envuelve el icono
   */
  animateThemeToggleIcon(btnOrContainer: HTMLElement): void {
    if (!this.shouldAnimate()) return;

    const iconEl = btnOrContainer.querySelector('svg') ?? btnOrContainer;
    if (iconEl === btnOrContainer) return; // No animar el botón completo

    gsap.fromTo(
      iconEl,
      { scale: 1, rotation: 0 },
      {
        scale: 1.2,
        rotation: 180,
        duration: 0.18,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
        clearProps: 'transform',
      },
    );
  }

  /**
   * Page route transition — salida
   * Variante híbrido premium: rápida (180ms), hacia arriba (-6px)
   * @param el - Elemento de la página
   * @param onComplete - Callback al finalizar
   */
  animatePageLeave(el: HTMLElement, onComplete: () => void): void {
    if (!this.shouldAnimate()) {
      onComplete();
      return;
    }

    gsap.to(el, {
      opacity: 0,
      y: -6,
      duration: 0.18,
      ease: 'power2.in',
      onComplete,
    });
  }

  /**
   * Page route transition — entrada
   * Variante híbrido premium: suave (280ms), desde abajo (+8px)
   * @param el - Elemento de la página
   */
  animatePageEnter(el: HTMLElement): void {
    if (!this.shouldAnimate()) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }

    gsap.fromTo(
      el,
      { opacity: 0, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration: 0.28,
        ease: 'power3.out',
        clearProps: 'transform',
      },
    );
  }

  /**
   * Fade in simple para elementos
   * @param el - Elemento a animar
   * @param delay - Delay opcional
   */
  fadeIn(el: HTMLElement, delay = 0): void {
    if (!this.shouldAnimate()) {
      gsap.set(el, { opacity: 1 });
      return;
    }

    gsap.fromTo(
      el,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.4,
        delay,
        ease: 'power2.out',
      },
    );
  }

  /**
   * Transición skeleton → contenido final.
   * Variante 2025/2026: fade + slide suave (sin scale/zoom).
   * Alineado con page transition híbrido premium (280ms, +8px).
   * @param el - Elemento del contenido final
   */
  animateSkeletonToContent(el: HTMLElement): void {
    if (!this.shouldAnimate()) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }

    gsap.fromTo(
      el,
      { opacity: 0, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration: 0.28,
        ease: 'power3.out',
        clearProps: 'transform',
      },
    );
  }

  /**
   * Panel overlay — entrada con feel gooey premium (elastic suave + blur sutil)
   * Duración deliberada, rebote refinado, materialización elegante.
   * @param el - Elemento panel
   */
  animatePanelIn(el: HTMLElement): void {
    if (!this.shouldAnimate()) {
      gsap.set(el, { opacity: 1, y: 0, scale: 1, filter: 'none' });
      return;
    }

    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.88, y: -10, filter: 'blur(6px)' },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 1,
        ease: 'elastic.out(1, 0.6)',
        clearProps: 'transform,filter',
      },
    );
  }

  /**
   * Panel overlay — salida premium (sutil, elegante)
   * @param el - Elemento panel
   * @param onComplete - Callback al finalizar
   */
  animatePanelOut(el: HTMLElement, onComplete?: () => void): void {
    if (!this.shouldAnimate()) {
      onComplete?.();
      return;
    }

    gsap.to(el, {
      opacity: 0,
      scale: 0.92,
      y: -8,
      duration: 0.45,
      ease: 'power3.in',
      onComplete,
    });
  }

  /**
   * Transición panel → drawer (estilo Flip).
   * Captura posición/tamaño del panel, aplica el cambio de layout y anima.
   * Nota: Usa getBoundingClientRect en lugar de GSAP Flip por conflicto de casing en Windows.
   * @param panelEl - Elemento panel (antes del cambio)
   * @param onLayoutChange - Callback que aplica el cambio de layout (ej: cambiar modo a drawer)
   * @param onComplete - Callback al finalizar la animación
   */
  animatePanelToDrawer(
    panelEl: HTMLElement,
    onLayoutChange: () => void,
    onComplete?: () => void,
  ): void {
    if (!isPlatformBrowser(this.platformId)) {
      onLayoutChange();
      onComplete?.();
      return;
    }
    if (!this.shouldAnimate()) {
      onLayoutChange();
      onComplete?.();
      return;
    }

    const rect = panelEl.getBoundingClientRect();
    const rightStart = window.innerWidth - rect.right;
    onLayoutChange();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        gsap.set(panelEl, {
          position: 'fixed',
          top: rect.top,
          left: 'auto',
          right: rightStart,
          width: rect.width,
          height: rect.height,
        });
        gsap.to(panelEl, {
          top: 0,
          right: 0,
          bottom: 0,
          width: Math.min(420, window.innerWidth),
          height: '100vh',
          opacity: 1,
          duration: 0.5,
          ease: 'power3.inOut',
          onComplete,
          overwrite: 'auto',
        });
      });
    });
  }

  /**
   * FLIP manual para reflow del bento grid.
   * Captura posiciones y tamaños de celdas, ejecuta callback (cambio de layout),
   * anima cada celda a su nueva posición (translate) y tamaño (height/width).
   * Nota: Usa getBoundingClientRect en lugar de GSAP Flip por conflicto de casing en Windows.
   *
   * @param gridContainer - Contenedor del bento-grid (sus hijos son las celdas)
   * @param onLayoutChange - Callback que aplica el cambio (ej: actualizar rows del paginador)
   * @param onComplete - Callback al finalizar la animación
   */
  animateBentoLayoutChange(
    gridContainer: HTMLElement,
    onLayoutChange: () => void,
    onComplete?: () => void,
  ): void {
    if (!isPlatformBrowser(this.platformId)) {
      onLayoutChange();
      onComplete?.();
      return;
    }
    if (!this.shouldAnimate()) {
      onLayoutChange();
      onComplete?.();
      return;
    }

    const cells = Array.from(gridContainer.children) as HTMLElement[];
    if (cells.length === 0) {
      onLayoutChange();
      onComplete?.();
      return;
    }

    const oldRects = cells.map((el) => el.getBoundingClientRect());
    onLayoutChange();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scrollables: { el: HTMLElement; overflow: string }[] = [];
        cells.forEach((el) => {
          el.querySelectorAll<HTMLElement>('.table-container').forEach((sc) => {
            scrollables.push({ el: sc, overflow: sc.style.overflow || '' });
            sc.style.overflow = 'hidden';
          });
        });

        const tl = gsap.timeline({
          onComplete: () => {
            cells.forEach((el) => gsap.set(el, { clearProps: 'height,width,overflow' }));
            scrollables.forEach(({ el, overflow }) => {
              el.style.overflow = overflow;
            });
            onComplete?.();
          },
        });
        cells.forEach((el, i) => {
          const oldRect = oldRects[i];
          const newRect = el.getBoundingClientRect();
          const deltaX = oldRect.left - newRect.left;
          const deltaY = oldRect.top - newRect.top;
          const heightChanged = Math.abs(oldRect.height - newRect.height) > 1;
          const widthChanged = Math.abs(oldRect.width - newRect.width) > 1;

          const fromVars: gsap.TweenVars = { x: deltaX, y: deltaY };
          const toVars: gsap.TweenVars = {
            x: 0,
            y: 0,
            duration: 0.45,
            ease: 'power3.out',
            clearProps: 'transform',
          };

          if (heightChanged) {
            fromVars.height = oldRect.height;
            fromVars.overflow = 'hidden';
            toVars.height = newRect.height;
          }
          if (widthChanged) {
            fromVars.width = oldRect.width;
            if (!fromVars.overflow) fromVars.overflow = 'hidden';
            toVars.width = newRect.width;
          }

          tl.fromTo(el, fromVars, toVars, 0);
        });
      });
    });
  }

  /**
   * FLIP para swap de contenido (ej: login ↔ recuperación).
   * Captura posición/tamaño del contenedor, aplica el cambio de contenido,
   * invierte (transform + height) y anima suavemente a la nueva forma.
   *
   * @param containerEl - Elemento contenedor cuyo contenido cambia
   * @param onContentChange - Callback que aplica el cambio (ej: mode.set('recovery'))
   * @param onComplete - Callback al finalizar la animación
   * @param options - Opciones premium: staggerChildren, duration, ease
   */
  animateContentSwap(
    containerEl: HTMLElement,
    onContentChange: () => void,
    onComplete?: () => void,
    options?: { staggerChildren?: boolean; duration?: number; ease?: string },
  ): void {
    if (!isPlatformBrowser(this.platformId)) {
      onContentChange();
      onComplete?.();
      return;
    }
    if (!this.shouldAnimate()) {
      onContentChange();
      onComplete?.();
      return;
    }

    const duration = options?.duration ?? 0.4;
    const ease = options?.ease ?? 'power3.out';
    const staggerChildren = options?.staggerChildren ?? false;

    const oldRect = containerEl.getBoundingClientRect();
    onContentChange();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const newRect = containerEl.getBoundingClientRect();
        const deltaX = oldRect.left - newRect.left;
        const deltaY = oldRect.top - newRect.top;
        const heightChanged = Math.abs(oldRect.height - newRect.height) > 1;
        const widthChanged = Math.abs(oldRect.width - newRect.width) > 1;

        if (staggerChildren) {
          const children = Array.from(containerEl.children) as HTMLElement[];
          gsap.set(children, { opacity: 0, y: 8 });
        }

        const fromVars: gsap.TweenVars = { x: deltaX, y: deltaY };
        const toVars: gsap.TweenVars = {
          x: 0,
          y: 0,
          duration,
          ease,
          clearProps: 'transform',
          onComplete: () => {
            gsap.set(containerEl, { clearProps: 'height,width,overflow' });
            if (staggerChildren) {
              const children = Array.from(containerEl.children) as HTMLElement[];
              gsap.fromTo(
                children,
                { opacity: 0, y: 8 },
                {
                  opacity: 1,
                  y: 0,
                  duration: 0.32,
                  ease: 'power3.out',
                  stagger: 0.05,
                  clearProps: 'transform',
                  onComplete: () => onComplete?.(),
                },
              );
            } else {
              onComplete?.();
            }
          },
        };

        if (heightChanged) {
          fromVars.height = oldRect.height;
          fromVars.overflow = 'hidden';
          toVars.height = newRect.height;
        }
        if (widthChanged) {
          fromVars.width = oldRect.width;
          if (!fromVars.overflow) fromVars.overflow = 'hidden';
          toVars.width = newRect.width;
        }

        gsap.fromTo(containerEl, fromVars, toVars);
      });
    });
  }

  /**
   * Drawer — entrada con backdrop (slide + blur/fade opcional).
   * @param backdropEl - Elemento backdrop u overlay
   * @param panelEl - Elemento panel lateral
   */
  animateDrawerEnter(backdropEl: HTMLElement, panelEl: HTMLElement): void {
    if (!this.shouldAnimate()) {
      gsap.set(backdropEl, { opacity: 1 });
      gsap.set(panelEl, { x: 0 });
      return;
    }

    const tl = gsap.timeline();
    tl.fromTo(
      backdropEl,
      { opacity: 0 },
      { opacity: 1, duration: 0.35, ease: 'power2.out' },
      0
    ).fromTo(
      panelEl,
      { x: '100%' },
      { x: '0%', duration: 0.45, ease: 'power3.out', clearProps: 'transform' },
      0
    );
  }

  /**
   * Drawer — salida con backdrop.
   * @param backdropEl - Elemento backdrop u overlay
   * @param panelEl - Elemento panel lateral
   * @param onComplete - Callback al finalizar
   */
  animateDrawerLeave(backdropEl: HTMLElement, panelEl: HTMLElement, onComplete?: () => void): void {
    if (!this.shouldAnimate()) {
      onComplete?.();
      return;
    }

    const tl = gsap.timeline({ onComplete });
    tl.to(backdropEl, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0)
      .to(panelEl, { x: '100%', duration: 0.35, ease: 'power3.in' }, 0);
  }

  /**
   * Layout Drawer — Entrada (modo adaptativo)
   *
   * - Desktop (≥768px): Layout-shift animando el width del elemento hermano.
   * - Mobile  (<768px): Panel fullscreen fixed + backdrop semitransparente.
   *
   * @param drawerEl  Elemento host del layout drawer
   * @param backdropEl Elemento backdrop (solo necesario en mobile)
   */
  animateLayoutDrawerEnter(drawerEl: HTMLElement, backdropEl: HTMLElement | null): void {
    const isMobile = window.innerWidth < 768;
    const panelEl = drawerEl.querySelector('[data-drawer-panel]') as HTMLElement;

    if (isMobile) {
      // ── MOBILE: fullscreen fixed con slide-in desde la derecha ────────────
      document.body.style.overflow = 'hidden'; // bloquear scroll del body

      gsap.set(drawerEl, {
        position: 'fixed',
        inset: '0',
        width: '100%',
        height: '100%',
        display: 'block', // 'flex' was causing inner elements to stack
        zIndex: 60,
        overflow: 'hidden',
        x: '0%', // asegurar que host no esté dezplazado
      });

      if (!this.shouldAnimate()) {
        if (backdropEl) gsap.set(backdropEl, { display: 'block', opacity: 0.5 });
        if (panelEl) gsap.set(panelEl, { x: '0%' });
        return;
      }

      const tl = gsap.timeline();

      if (backdropEl) {
        gsap.set(backdropEl, { display: 'block' });
        tl.fromTo(backdropEl, { opacity: 0 }, { opacity: 0.5, duration: 0.3, ease: 'power2.out' }, 0);
      }

      if (panelEl) {
        tl.fromTo(panelEl, { x: '100%' }, { x: '0%', duration: 0.4, ease: 'power3.out' }, 0);
      }
    } else {
      // ── DESKTOP: layout-shift animando el width ───────────────────────────
      const targetWidth = Math.max(400, window.innerWidth * 0.45);

      if (!this.shouldAnimate()) {
        gsap.set(drawerEl, {
          width: targetWidth,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          borderLeft: '1px solid var(--border-subtle)',
        });
        if (panelEl) gsap.set(panelEl, { clearProps: 'x' }); // limpiar posible estado móvil
        return;
      }

      gsap.set(drawerEl, {
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        borderLeft: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      });
      if (panelEl) gsap.set(panelEl, { clearProps: 'x' });

      gsap.fromTo(
        drawerEl,
        { width: 0, opacity: 0 },
        {
          width: targetWidth,
          opacity: 1,
          duration: 0.45,
          ease: 'power3.out',
          clearProps: 'opacity',
        }
      );
    }
  }

  /**
   * Layout Drawer — Salida (modo adaptativo)
   *
   * - Desktop: colapsa el width a 0.
   * - Mobile:  slide-out a la derecha + fade del backdrop.
   *
   * @param drawerEl  Elemento host
   * @param backdropEl Elemento backdrop
   * @param onComplete Callback crítico (destruye el NgComponentOutlet)
   */
  animateLayoutDrawerLeave(drawerEl: HTMLElement, backdropEl: HTMLElement | null, onComplete: () => void): void {
    const isMobile = window.innerWidth < 768;
    const panelEl = drawerEl.querySelector('[data-drawer-panel]') as HTMLElement;

    if (isMobile) {
      // ── MOBILE: slide-out a la derecha + fade del backdrop ────────────────
      document.body.style.overflow = ''; // restaurar scroll

      if (!this.shouldAnimate()) {
        gsap.set(drawerEl, { display: 'none' });
        if (backdropEl) gsap.set(backdropEl, { display: 'none', opacity: 0 });
        if (panelEl) gsap.set(panelEl, { x: '100%' });
        onComplete();
        return;
      }

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(drawerEl, { display: 'none', clearProps: 'position,inset,zIndex,x' });
          if (backdropEl) gsap.set(backdropEl, { display: 'none', opacity: 0 });
          if (panelEl) gsap.set(panelEl, { clearProps: 'x' });
          onComplete();
        },
      });

      if (panelEl) {
        tl.to(panelEl, { x: '100%', duration: 0.35, ease: 'power3.in' }, 0);
      }
      if (backdropEl) {
        tl.to(backdropEl, { opacity: 0, duration: 0.25, ease: 'power2.in' }, 0);
      }
    } else {
      // ── DESKTOP: colapso del width ────────────────────────────────────────
      if (!this.shouldAnimate()) {
        gsap.set(drawerEl, { display: 'none', width: '0px' });
        onComplete();
        return;
      }

      gsap.to(drawerEl, {
        width: 0,
        opacity: 0,
        duration: 0.35,
        ease: 'power3.in',
        onComplete: () => {
          gsap.set(drawerEl, { display: 'none', clearProps: 'opacity' });
          onComplete();
        },
      });
    }
  }

  /**
   * Drawer — salida (cierre - versión legacy sin backdrop).
   * @param drawerEl - Elemento drawer
   * @param onComplete - Callback al finalizar
   */
  animateDrawerOut(drawerEl: HTMLElement, onComplete?: () => void): void {
    if (!this.shouldAnimate()) {
      onComplete?.();
      return;
    }
    gsap.to(drawerEl, {
      x: '100%',
      duration: 0.35,
      ease: 'power3.in',
      onComplete,
    });
  }

  /**
   * Press feedback — scale(0.98) al pulsar, restaura al soltar.
   * Reutilizable en botones, pills, etc. Respetando prefers-reduced-motion.
   * @param el - Elemento interactivo
   * @returns Función de cleanup para ngOnDestroy
   */
  addPressFeedback(el: HTMLElement): () => void {
    if (!this.shouldAnimate()) return () => { };

    const down = () =>
      gsap.to(el, {
        scale: 0.98,
        duration: 0.1,
        ease: 'power2.out',
        overwrite: 'auto',
      });

    const up = () =>
      gsap.to(el, {
        scale: 1,
        duration: 0.2,
        ease: 'power2.out',
        clearProps: 'transform',
        overwrite: 'auto',
      });

    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);

    return () => {
      el.removeEventListener('mousedown', down);
      el.removeEventListener('mouseup', up);
      el.removeEventListener('mouseleave', up);
      gsap.killTweensOf(el);
    };
  }

  /**
   * Hover + press para botones/triggers — coherente con pills del sidebar.
   * Hover: scale 1.02, y: -1. Press: scale 0.98.
   * @param el - Elemento interactivo (botón, trigger)
   * @returns Función de cleanup para ngOnDestroy
   */
  addInteractiveFeedback(el: HTMLElement): () => void {
    if (!this.shouldAnimate()) return () => { };

    let isHovered = false;

    const enter = () => {
      isHovered = true;
      gsap.to(el, {
        scale: 1.02,
        y: -1,
        duration: 0.2,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    };

    const leave = () => {
      isHovered = false;
      gsap.to(el, {
        scale: 1,
        y: 0,
        duration: 0.25,
        ease: 'power2.inOut',
        clearProps: 'transform',
        overwrite: 'auto',
      });
    };

    const down = () =>
      gsap.to(el, {
        scale: 0.98,
        y: 0,
        duration: 0.1,
        ease: 'power2.out',
        overwrite: 'auto',
      });

    const up = () =>
      gsap.to(el, {
        scale: isHovered ? 1.02 : 1,
        y: isHovered ? -1 : 0,
        duration: 0.2,
        ease: 'power2.out',
        clearProps: isHovered ? '' : 'transform',
        overwrite: 'auto',
      });

    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);

    return () => {
      el.removeEventListener('mouseenter', enter);
      el.removeEventListener('mouseleave', leave);
      el.removeEventListener('mousedown', down);
      el.removeEventListener('mouseup', up);
      gsap.killTweensOf(el);
    };
  }

  /**
   * Shake horizontal suave para inputs con errores de validación.
   * Patrón premium: 3-4 ciclos de ±4px, ~0.4s total, ease power2.out.
   * Respetando prefers-reduced-motion.
   * @param el - Elemento input o wrapper del campo a sacudir
   */
  animateInputError(el: HTMLElement): void {
    if (!this.shouldAnimate()) return;

    const tl = gsap.timeline();
    tl.to(el, { x: 4, duration: 0.05, ease: 'power2.out' })
      .to(el, { x: -4, duration: 0.1, ease: 'power2.out' })
      .to(el, { x: 4, duration: 0.1, ease: 'power2.out' })
      .to(el, { x: -2, duration: 0.08, ease: 'power2.out' })
      .to(el, { x: 0, duration: 0.07, ease: 'power2.out', clearProps: 'transform' });
  }

  /**
   * Hover + press en pills de navegación (sidebar)
   * Scale sutil, nudge horizontal, feedback de click (usa addPressFeedback internamente)
   * @param containerEl - Contenedor con .p-menu-item-content o .p-menu-item-link
   */
  addPillHovers(containerEl: HTMLElement): () => void {
    if (!this.shouldAnimate()) return () => { };

    let pills = containerEl.querySelectorAll<HTMLElement>('.p-menu-item-content');
    if (pills.length === 0) {
      pills = containerEl.querySelectorAll<HTMLElement>('.p-menu-item-link');
    }
    const cleanupFns: Array<() => void> = [];

    pills.forEach((el) => {
      let isHovered = false;

      const enter = () => {
        isHovered = true;
        gsap.to(el, {
          scale: 1.02,
          x: 2,
          duration: 0.2,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      };

      const leave = () => {
        isHovered = false;
        gsap.to(el, {
          scale: 1,
          x: 0,
          duration: 0.25,
          ease: 'power2.inOut',
          clearProps: 'transform',
          overwrite: 'auto',
        });
      };

      const down = () => {
        gsap.to(el, {
          scale: 0.98,
          duration: 0.1,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      };

      const up = () => {
        gsap.to(el, {
          scale: isHovered ? 1.02 : 1,
          x: isHovered ? 2 : 0,
          duration: 0.2,
          ease: 'power2.out',
          clearProps: isHovered ? '' : 'transform',
          overwrite: 'auto',
        });
      };

      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      el.addEventListener('mousedown', down);
      el.addEventListener('mouseup', up);

      cleanupFns.push(() => {
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('mouseleave', leave);
        el.removeEventListener('mousedown', down);
        el.removeEventListener('mouseup', up);
        gsap.killTweensOf(el);
      });
    });

    return () => cleanupFns.forEach((fn) => fn());
  }

  /**
   * Drawer mobile — backdrop fade + sidebar slide. Profesional, sin deslizamiento del overlay.
   * Backdrop: solo opacity. Aside: solo x. Respetando prefers-reduced-motion.
   * @param backdrop - Elemento backdrop (full-screen)
   * @param aside - Elemento aside (panel lateral)
   * @param open - true = abrir, false = cerrar
   * @param onCloseComplete - Callback al terminar animación de cierre
   */
  animateDrawer(
    backdrop: HTMLElement,
    aside: HTMLElement,
    open: boolean,
    onCloseComplete?: () => void,
  ): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const duration = this.prefersReducedMotion ? 0 : 0.32;
    const easeOpen = 'power3.out';
    const easeClose = 'power3.in';

    if (open) {
      gsap.killTweensOf([backdrop, aside]);
      gsap.set(backdrop, { opacity: 0, visibility: 'visible', pointerEvents: 'auto' });
      gsap.set(aside, { xPercent: -100 });
      gsap.to(backdrop, {
        opacity: 1,
        duration,
        ease: easeOpen,
      });
      gsap.to(aside, {
        xPercent: 0,
        duration,
        ease: easeOpen,
        overwrite: 'auto',
      });
    } else {
      gsap.killTweensOf([backdrop, aside]);
      gsap.to(backdrop, {
        opacity: 0,
        duration: this.prefersReducedMotion ? 0 : 0.22,
        ease: easeClose,
      });
      gsap.to(aside, {
        xPercent: -100,
        duration,
        ease: easeClose,
        overwrite: 'auto',
        onComplete: () => {
          gsap.set(backdrop, { visibility: 'hidden', pointerEvents: 'none' });
          onCloseComplete?.();
        },
      });
    }
  }

  /**
   * Animación de entrada para toasts — slide desde la derecha + fade.
   * Duración: ~250ms (power2.out). Respetando prefers-reduced-motion.
   * @param el - Elemento toast (ej. .p-toast-message)
   */
  animateToastIn(el: HTMLElement): void {
    if (!this.shouldAnimate()) {
      gsap.set(el, { opacity: 1, x: 0 });
      return;
    }

    const duration = this.getTokenMs('--duration-toast-enter') / 1000 || 0.25;
    gsap.fromTo(
      el,
      { opacity: 0, x: 80 },
      {
        opacity: 1,
        x: 0,
        duration,
        ease: 'power2.out',
        clearProps: 'transform',
      },
    );
  }

  /**
   * Animación de salida para toasts — slide hacia la derecha + fade.
   * Duración: ~180ms (power2.in). Respetando prefers-reduced-motion.
   * @param el - Elemento toast
   * @param onComplete - Callback al terminar
   */
  animateToastOut(el: HTMLElement, onComplete?: () => void): void {
    if (!this.shouldAnimate()) {
      onComplete?.();
      return;
    }

    const duration = this.getTokenMs('--duration-toast-leave') / 1000 || 0.18;
    gsap.to(el, {
      opacity: 0,
      x: 80,
      duration,
      ease: 'power2.in',
      onComplete: () => {
        onComplete?.();
      },
    });
  }

  /**
   * Entrada del panel de un paso del Stepper (slide + fade).
   * @param el - Contenido del panel (.stepper-step-content)
   */
  animateStepperPanelIn(el: HTMLElement): void {
    if (!this.shouldAnimate()) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }
    gsap.fromTo(
      el,
      { opacity: 0, y: 12 },
      {
        opacity: 1,
        y: 0,
        duration: 0.35,
        ease: 'power3.out',
        clearProps: 'transform',
      },
    );
  }

  /**
   * Rest timer — entrada del círculo de countdown.
   * Scale + fade con rebote suave.
   * @param el - Elemento del círculo del temporizador
   */
  animateRestTimerCircleIn(el: HTMLElement): void {
    if (!this.shouldAnimate()) {
      gsap.set(el, { opacity: 1, scale: 1 });
      return;
    }
    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.85 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.45,
        ease: 'back.out(1.2)',
        clearProps: 'transform',
      },
    );
  }

  /**
   * Rest timer — flip 3D del dígito al cambiar el segundo.
   * @param el - Elemento que muestra el tiempo (span)
   * @param newValue - Nuevo texto a mostrar
   * @param onComplete - Callback opcional al finalizar el flip
   */
  animateRestTimerDigitFlip(el: HTMLElement, newValue: string, onComplete?: () => void): void {
    if (!this.shouldAnimate()) {
      el.textContent = newValue;
      onComplete?.();
      return;
    }
    gsap.to(el, {
      rotationX: -90,
      opacity: 0,
      duration: 0.12,
      ease: 'power2.in',
      onComplete: () => {
        el.textContent = newValue;
        gsap.fromTo(
          el,
          { rotationX: 90, opacity: 0 },
          {
            rotationX: 0,
            opacity: 1,
            duration: 0.12,
            ease: 'power2.out',
            clearProps: 'transform',
            onComplete,
          },
        );
      },
    });
  }

  /**
   * Rest timer — pulso de urgencia cuando quedan pocos segundos.
   * Usa una capa separada (overlay) para no afectar el gradiente del círculo.
   * Solo anima opacidad (sin scale) para evitar vibración.
   * @param el - Elemento overlay (capa separada, no el círculo del gradiente)
   * @returns Función de cleanup para detener el pulso
   */
  animateRestTimerPulse(el: HTMLElement): () => void {
    if (!this.shouldAnimate()) return () => { };

    gsap.set(el, { opacity: 0 });
    const tween = gsap.to(el, {
      opacity: 0.7,
      duration: 0.6,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    return () => {
      tween.kill();
      gsap.set(el, { opacity: 0 });
    };
  }

  /**
   * Rest timer — animación al completar (feedback visual).
   * @param el - Elemento del círculo
   * @param onComplete - Callback al finalizar
   */
  animateRestTimerComplete(el: HTMLElement, onComplete?: () => void): void {
    if (!this.shouldAnimate()) {
      onComplete?.();
      return;
    }
    gsap.to(el, {
      scale: 1.08,
      duration: 0.25,
      ease: 'back.out(2)',
      onComplete: () => {
        gsap.to(el, {
          scale: 1,
          duration: 0.2,
          ease: 'power2.out',
          clearProps: 'transform',
          onComplete,
        });
      },
    });
  }

  /**
   * Stagger list items
   * @param items - NodeList o array de elementos
   */
  staggerListItems(items: NodeListOf<Element> | Element[]): void {
    if (!this.shouldAnimate()) return;

    gsap.fromTo(
      items,
      { opacity: 0, x: -16 },
      {
        opacity: 1,
        x: 0,
        duration: 0.4,
        ease: 'power2.out',
        stagger: 0.08,
        clearProps: 'transform',
      },
    );
  }

  /**
   * Bell ring animation — estilo Aladino.
   * Oscilación pendular desde el origen superior del elemento, con amplitud decreciente.
   * Disparar al abrir el panel de notificaciones o al recibir una nueva notificación.
   * @param el - Elemento botón de campana o su contenedor
   */
  animateBell(el: HTMLElement): void {
    if (!this.shouldAnimate()) return;

    // Animar solo el SVG — el fondo del botón no rota
    const iconEl = (el.querySelector('svg') ?? el) as HTMLElement;

    gsap.killTweensOf(iconEl);
    // Pivote en el borde superior del SVG → comportamiento de campana colgante
    gsap.set(iconEl, { transformOrigin: '50% 0%' });

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(iconEl, { clearProps: 'transform,transformOrigin' });
      },
    });

    tl.to(iconEl, { rotation: 20, duration: 0.08, ease: 'power2.out' })
      .to(iconEl, { rotation: -16, duration: 0.12, ease: 'power2.inOut' })
      .to(iconEl, { rotation: 13, duration: 0.1, ease: 'power2.inOut' })
      .to(iconEl, { rotation: -9, duration: 0.09, ease: 'power2.inOut' })
      .to(iconEl, { rotation: 5, duration: 0.08, ease: 'power2.inOut' })
      .to(iconEl, { rotation: 0, duration: 0.1, ease: 'power2.out' });
  }

  /**
   * Check if animations should run based on user preferences
   */
  private shouldAnimate(): boolean {
    return isPlatformBrowser(this.platformId) && !this.prefersReducedMotion;
  }

  /** Obtiene un token de duración en ms (ej: "250ms" → 250) */
  private getTokenMs(name: string): number {
    if (typeof document === 'undefined') return 0;
    const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!val) return 0;
    const match = val.match(/^(\d+(?:\.\d+)?)\s*ms$/);
    if (match) return parseFloat(match[1]);
    const matchS = val.match(/^(\d+(?:\.\d+)?)\s*s$/);
    if (matchS) return parseFloat(matchS[1]) * 1000;
    return 0;
  }

  /**
   * Returns true if animations should run (browser + user hasn't reduced motion).
   * Use in components that need to conditionally run custom GSAP animations.
   */
  canAnimate(): boolean {
    return this.shouldAnimate();
  }

  /**
   * Kill all active GSAP animations (cleanup)
   */
  killAll(): void {
    if (isPlatformBrowser(this.platformId)) {
      gsap.killTweensOf('*');
    }
  }
}
