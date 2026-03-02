import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';

export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    initials: string;
}

/**
 * UserPanelComponent — panel flotante para el menú del usuario en el sidebar.
 * 
 * Dumb component: solo input() y output().
 * Hereda animaciones de entrada del directiva appAnimateIn manejada por su wrapper.
 */
@Component({
    selector: 'app-user-panel',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [IconComponent],
    template: `
    <div class="user-panel card" role="menu" aria-label="Menú de usuario">
      <!-- Info Header -->
      <div class="user-panel__header">
        <div class="user-panel__avatar" aria-hidden="true">
          {{ user()?.initials }}
        </div>
        <div class="user-panel__info min-w-0">
          <p class="user-panel__name truncate">{{ user()?.name }}</p>
          <p class="user-panel__email truncate">{{ user()?.email }}</p>
        </div>
      </div>

      <div class="my-1 border-t border-border-subtle" role="separator"></div>

      <!-- Action List -->
      <ul class="user-panel__list" role="presentation">
        <li role="none">
          <button
            class="user-panel__item"
            role="menuitem"
            (click)="action.emit('profile')"
          >
            <app-icon name="user" class="text-text-muted" [size]="16" />
            <span>Mi perfil</span>
          </button>
        </li>
        <li role="none">
          <button
            class="user-panel__item"
            role="menuitem"
            (click)="action.emit('settings')"
          >
            <app-icon name="settings" class="text-text-muted" [size]="16" />
            <span>Ajustes</span>
          </button>
        </li>
      </ul>

      <div class="my-1 border-t border-border-subtle" role="separator"></div>

      <!-- Logout Action -->
      <ul class="user-panel__list" role="presentation">
        <li role="none">
          <button
            class="user-panel__item text-error hover:bg-state-error-bg hover:text-error"
            role="menuitem"
            (click)="logout.emit()"
          >
            <app-icon name="log-out" [size]="16" />
            <span>Cerrar sesión</span>
          </button>
        </li>
      </ul>
    </div>
  `,
    styleUrl: './user-panel.component.scss',
})
export class UserPanelComponent {
    readonly user = input.required<User | null>();

    readonly action = output<'profile' | 'settings'>();
    readonly logout = output<void>();
}
