import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

// Facades
import { FlotaFacade } from '@core/facades/flota.facade';
import type { VehicleTableRow } from '@core/models/ui/vehicle-table.model';

// Pre-set hours: 08:00 – 18:00 (11 rows)
const ROUTE_HOURS = Array.from({ length: 11 }, (_, i) => {
  const h = i + 8;
  return `${String(h).padStart(2, '0')}:00`;
});

/**
 * RouteSheetComponent — Página imprimible (RF-091)
 *
 * Optimizada para impresión A4. Se auto-imprime al cargar.
 * CSS usa @media print para ocultar el shell de la app (sidebar, topbar).
 */
@Component({
  selector: 'app-route-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <!-- Botón no-print -->
    <div class="no-print fixed top-4 right-4 z-50 flex gap-2">
      <button
        class="px-4 py-2 bg-base border border-border-subtle rounded-lg text-sm font-medium text-text-primary hover:bg-elevated transition-colors shadow-sm"
        onclick="window.print()"
      >
        Imprimir
      </button>
      <button
        class="px-4 py-2 bg-base border border-border-subtle rounded-lg text-sm font-medium text-text-muted hover:bg-elevated transition-colors shadow-sm"
        onclick="window.close()"
      >
        Cerrar
      </button>
    </div>

    <!-- Hoja A4 -->
    <div class="route-sheet-page">

      <!-- Header -->
      <div class="sheet-header">
        <div class="sheet-logo">Autoescuela Chillán</div>
        <div class="sheet-header-right">
          <div><strong>Sede:</strong> {{ vehicle()?.branchId === 2 ? 'Sucursal' : 'Chillán Centro' }}</div>
          <div><strong>Fecha:</strong> ____/____/______</div>
        </div>
      </div>

      <!-- Título -->
      <div class="sheet-title">HOJA DE RUTA DIARIA</div>

      <!-- Info del vehículo -->
      <div class="sheet-info">
        <div class="sheet-info-item">
          <span class="sheet-label">Vehículo / Patente:</span>
          <span class="sheet-value">
            {{ vehicle() ? vehicle()!.licensePlate + ' (' + vehicle()!.vehicleLabel + ')' : '________________' }}
          </span>
        </div>
        <div class="sheet-info-item">
          <span class="sheet-label">Kilometraje Inicial:</span>
          <span class="sheet-value-empty"></span>
        </div>
        <div class="sheet-info-item">
          <span class="sheet-label">Instructor a cargo:</span>
          <span class="sheet-value">{{ vehicle()?.instructorName ?? '________________' }}</span>
        </div>
        <div class="sheet-info-item">
          <span class="sheet-label">Kilometraje Final:</span>
          <span class="sheet-value-empty"></span>
        </div>
      </div>

      <!-- Tabla de horarios -->
      <table class="sheet-table">
        <thead>
          <tr>
            <th class="col-hora">HORA</th>
            <th class="col-alumno">ALUMNO</th>
            <th class="col-actividad">RUTINA / ACTIVIDAD</th>
            <th class="col-km">KM FINAL</th>
            <th class="col-firma">FIRMA ALUMNO</th>
          </tr>
        </thead>
        <tbody>
          @for (hora of hours; track hora) {
            <tr class="sheet-row">
              <td class="col-hora text-center font-bold">{{ hora }}</td>
              <td class="col-alumno"></td>
              <td class="col-actividad"></td>
              <td class="col-km"></td>
              <td class="col-firma"></td>
            </tr>
          }
        </tbody>
      </table>

      <!-- Pie: Observaciones -->
      <div class="sheet-footer">
        <div class="sheet-footer-title">OBSERVACIONES / FALLAS MECÁNICAS DETECTADAS:</div>
      </div>

    </div>
  `,
  styles: [`
    /* ============================================================
       ESTILOS NORMALES (preview en el navegador)
    ============================================================ */
    :host {
      display: block;
      min-height: 100vh;
      background: var(--surface);
      padding: 2rem;
    }

    .route-sheet-page {
      max-width: 794px; /* A4 width en 96dpi */
      margin: 0 auto;
      background: white;
      padding: 2cm;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #000;
    }

    /* Header */
    .sheet-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
      border-bottom: 2px solid #000;
      padding-bottom: 1rem;
    }
    .sheet-logo { font-size: 1.4rem; font-weight: bold; }
    .sheet-header-right { text-align: right; font-size: 11px; line-height: 1.8; }

    /* Título */
    .sheet-title {
      text-align: center;
      font-size: 1.1rem;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1.25rem;
    }

    /* Info */
    .sheet-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem 1.5rem;
      margin-bottom: 1.5rem;
    }
    .sheet-info-item { display: flex; gap: 0.5rem; align-items: baseline; }
    .sheet-label { font-weight: bold; white-space: nowrap; }
    .sheet-value { border-bottom: 1px dotted #000; flex: 1; min-height: 1.2em; }
    .sheet-value-empty { border-bottom: 1px dotted #000; flex: 1; min-height: 1.2em; }

    /* Tabla */
    .sheet-table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
    .sheet-table th, .sheet-table td {
      border: 1px solid #000;
      padding: 0.35rem 0.5rem;
      text-align: left;
      vertical-align: middle;
    }
    .sheet-table th { background: #f0f0f0; font-weight: bold; text-align: center; font-size: 11px; }
    .sheet-row { height: 40px; }

    /* Columnas fijas */
    .col-hora { width: 60px; }
    .col-alumno { width: 22%; }
    .col-actividad { }
    .col-km { width: 70px; }
    .col-firma { width: 14%; }

    /* Footer */
    .sheet-footer {
      border: 1px solid #000;
      padding: 0.75rem;
      min-height: 90px;
    }
    .sheet-footer-title { font-weight: bold; margin-bottom: 0.5rem; border-bottom: 1px solid #000; display: inline-block; padding-bottom: 0.25rem; }

    /* ============================================================
       MEDIA PRINT
    ============================================================ */
    @media print {
      @page { margin: 1cm; size: A4; }

      /* Ocultar todo el shell de Angular (sidebar, topbar) excepto este componente */
      body > * { display: none !important; }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      app-root,
      app-admin-shell,
      app-layout-shell,
      .p-drawer,
      .no-print { display: none !important; }

      /* Mostrar solo la hoja */
      app-route-sheet,
      app-route-sheet .route-sheet-page {
        display: block !important;
        visibility: visible !important;
        position: fixed !important;
        top: 0; left: 0;
        width: 100%; height: 100%;
        margin: 0; padding: 0;
        box-shadow: none;
      }

      .route-sheet-page {
        max-width: 100%;
        padding: 0;
        box-shadow: none;
      }

      .no-print { display: none !important; }
    }
  `],
})
export class RouteSheetComponent implements OnInit, AfterViewInit {
  private readonly facade = inject(FlotaFacade);
  private readonly route = inject(ActivatedRoute);

  readonly vehicle = signal<VehicleTableRow | null>(null);
  readonly hours = ROUTE_HOURS;

  ngOnInit(): void {
    // Inicializar facade para tener datos de vehículo
    void this.facade.init();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam && idParam !== 'all') {
      const id = Number(idParam);
      // Intentamos encontrar en caché; si no, esperamos a que cargue
      const found = this.facade.vehicles().find((v) => v.id === id);
      if (found) this.vehicle.set(found);
    }
  }

  ngAfterViewInit(): void {
    // Auto-imprimir al abrir
    setTimeout(() => window.print(), 600);
  }
}
