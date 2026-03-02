import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GsapAnimationsService } from './gsap-animations.service';
import { MessageService } from 'primeng/api';

export type ColorMode = 'light' | 'dark';

/**
 * ThemeService - Gestión de modo claro/oscuro
 *
 * Ciclo simple: light ↔ dark (sin opción "sistema" para mejor UX e iconografía).
 * El modo oscuro se aplica con [data-mode='dark'] en el documentElement.
 *
 * Uso:
 * ```typescript
 * readonly themeService = inject(ThemeService);
 * this.themeService.cycleColorMode(event);
 * this.themeService.setColorMode('dark');
 * ```
 */
@Injectable({
    providedIn: 'root',
})
export class ThemeService {
    private platformId = inject(PLATFORM_ID);
    private gsap = inject(GsapAnimationsService);
    private messageService = inject(MessageService);

    private readonly STORAGE_KEY_MODE = 'app-color-mode';

    /** Si el modo oscuro está activo */
    readonly darkMode = signal<boolean>(false);

    /** true mientras dura la transición de tema — para deshabilitar el botón */
    readonly isThemeTransitioning = signal<boolean>(false);

    constructor() {
        this.initializeDarkMode();
        this.removeLegacyThemeAttribute();
    }

    /** Elimina data-theme legacy (rojo/azul) si existía en localStorage/DOM */
    private removeLegacyThemeAttribute(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        document.documentElement.removeAttribute('data-theme');
        localStorage.removeItem('app-theme');
    }

    // ─── Modo Oscuro / Claro ─────────────────────────────────────────────────

    private initializeDarkMode(): void {
        if (!isPlatformBrowser(this.platformId)) return;

        let saved = this.loadFromStorage(this.STORAGE_KEY_MODE);
        // Migrar 'system' legacy → usar preferencia actual y guardar explícito
        if (saved === 'system') {
            saved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            this.saveToStorage(this.STORAGE_KEY_MODE, saved);
        }

        const isDark = saved === 'dark';
        this.applyDarkModeToDOM(isDark);
        this.darkMode.set(isDark);
    }

    /**
     * Alterna entre light y dark. Un solo clic, sin menú.
     * @param clickEvent - Opcional: evento del clic para reveal circular desde el botón
     */
    cycleColorMode(clickEvent?: MouseEvent): void {
        if (!isPlatformBrowser(this.platformId)) return;
        if (this.isThemeTransitioning()) return;

        const next: ColorMode = this.darkMode() ? 'light' : 'dark';
        const origin = clickEvent ? { x: clickEvent.clientX, y: clickEvent.clientY } : undefined;

        this.isThemeTransitioning.set(true);
        this.gsap
            .animateThemeChange(
                () => this.applyColorMode(next),
                origin
            )
            .finally(() => {
                this.isThemeTransitioning.set(false);
                this.showThemeToast(next === 'dark');
            });
    }

    private applyColorMode(mode: ColorMode): void {
        const isDark = mode === 'dark';
        this.darkMode.set(isDark);
        this.applyDarkModeToDOM(isDark);
        this.saveToStorage(this.STORAGE_KEY_MODE, mode);
    }

    /**
     * Establece el modo explícitamente (para API externa).
     * @param mode - 'light' | 'dark'
     */
    setColorMode(mode: ColorMode): void {
        if (!isPlatformBrowser(this.platformId)) return;
        if (this.isThemeTransitioning()) return;
        if (mode === 'light' && !this.darkMode()) return;
        if (mode === 'dark' && this.darkMode()) return;
        this.isThemeTransitioning.set(true);
        this.gsap
            .animateThemeChange(() => this.applyColorMode(mode))
            .finally(() => {
                this.isThemeTransitioning.set(false);
                this.showThemeToast(mode === 'dark');
            });
    }

    private showThemeToast(isDark: boolean): void {
        const msg = isDark ? 'Modo oscuro activado' : 'Modo claro activado';
        this.messageService.add({
            severity: 'info',
            summary: msg,
            detail: '',
            life: 1500,
            styleClass: 'toast-theme', // Barra 1.5s sincronizada
        });
    }

    private applyDarkModeToDOM(isDark: boolean): void {
        if (!isPlatformBrowser(this.platformId)) return;
        if (isDark) {
            document.documentElement.setAttribute('data-mode', 'dark');
        } else {
            document.documentElement.removeAttribute('data-mode');
        }
    }

    // ─── Utilidades ──────────────────────────────────────────────────────────

    private loadFromStorage(key: string): string | null {
        if (!isPlatformBrowser(this.platformId)) return null;
        return localStorage.getItem(key);
    }

    private saveToStorage(key: string, value: string): void {
        if (!isPlatformBrowser(this.platformId)) return;
        localStorage.setItem(key, value);
    }
}
