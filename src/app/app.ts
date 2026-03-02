import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  /**
   * Inyectar ThemeService aquí garantiza que se inicialice en TODAS las rutas
   * (login, app/*, 404), no solo cuando SidebarComponent carga.
   * Sin esto, el dark mode guardado en localStorage nunca se aplica en /login.
   */
  private readonly _theme = inject(ThemeService);
}
