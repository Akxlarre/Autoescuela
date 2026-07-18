import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { CertificacionClaseBFacade } from '@core/facades/certificacion-clase-b.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { CertificacionClaseBContentComponent } from '@shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component';
import { HistorialEmisionesDrawerComponent } from '@features/admin/certificacion/drawers/historial-emisiones-drawer.component';
import { GenerarPendientesDrawerComponent } from '@features/admin/certificacion/drawers/generar-pendientes-drawer.component';
import { EnviarMasivoDrawerComponent } from '@features/admin/certificacion/drawers/enviar-masivo-drawer.component';

/**
 * SecretariaCertificadosComponent — Smart component.
 * Ruta: /app/secretaria/certificados
 *
 * La secretaria siempre ve su propia sede (branchId del usuario autenticado).
 */
@Component({
  selector: 'app-secretaria-certificados',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CertificacionClaseBContentComponent],
  template: `
    <app-certificacion-clase-b-content
      [alumnos]="facade.alumnos()"
      [kpis]="facade.kpis()"
      [isLoading]="facade.isLoading()"
      [generatingId]="facade.generatingId()"
      [sendingEmailId]="facade.sendingEmailId()"
      [sendingMasivo]="facade.sendingMasivo()"
      [isExporting]="facade.isExporting()"
      [isGeneratingPendientes]="facade.isGeneratingPendientes()"
      [isAdmin]="isAdmin()"
      (generarCertificado)="facade.generarCertificado($event)"
      (verCertificado)="facade.verCertificado($event.storagePath, $event.nombre)"
      (enviarEmail)="facade.enviarEmail($event)"
      (abrirHistorialDrawer)="openHistorialDrawer()"
      (abrirGenerarPendientesDrawer)="openGenerarPendientesDrawer()"
      (abrirEnviarMasivoDrawer)="openEnviarMasivoDrawer()"
      (exportar)="facade.exportar()"
    />
  `,
})
export class SecretariaCertificadosComponent implements OnInit {
  protected readonly facade = inject(CertificacionClaseBFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly isAdmin = computed(() => this.authFacade.currentUser()?.role === 'admin');

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected openHistorialDrawer(): void {
    this.layoutDrawer.open(HistorialEmisionesDrawerComponent, 'Historial de Emisiones', 'scroll');
  }

  protected openGenerarPendientesDrawer(): void {
    this.layoutDrawer.open(GenerarPendientesDrawerComponent, 'Generar Pendientes', 'file-check');
  }

  protected openEnviarMasivoDrawer(): void {
    this.layoutDrawer.open(EnviarMasivoDrawerComponent, 'Enviar Emails Masivo', 'send');
  }
}
