import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ThemeService } from '@core/services/ui/theme.service';
import { ToastService } from '@core/services/ui/toast.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { StatBoxComponent } from '@shared/components/stat-box/stat-box.component';
import { FormsModule } from '@angular/forms';
import { ConfiguradorHorariosDrawerComponent } from '@features/admin/configuracion-horario/configurador-horarios-drawer.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

@Component({
  selector: 'app-ajustes-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, StatBoxComponent, FormsModule, DrawerFormComponent],
  template: `
    <div class="ajustes-container flex h-full flex-col">
      <!-- Tabs Navigation -->
      <div class="flex border-b border-border-subtle shrink-0 mb-4">
        <button
          type="button"
          class="flex-1 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer"
          [class.border-brand]="activeTab() === 'perfil'"
          [class.text-brand]="activeTab() === 'perfil'"
          [class.border-transparent]="activeTab() !== 'perfil'"
          [class.text-text-secondary]="activeTab() !== 'perfil'"
          (click)="setTab('perfil')"
        >
          Mi Perfil
        </button>
        <button
          type="button"
          class="flex-1 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer"
          [class.border-brand]="activeTab() === 'config'"
          [class.text-brand]="activeTab() === 'config'"
          [class.border-transparent]="activeTab() !== 'config'"
          [class.text-text-secondary]="activeTab() !== 'config'"
          (click)="setTab('config')"
        >
          Ajustes
        </button>
        @if (isAdmin()) {
          <button
            type="button"
            class="flex-1 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer"
            [class.border-brand]="activeTab() === 'seguridad'"
            [class.text-brand]="activeTab() === 'seguridad'"
            [class.border-transparent]="activeTab() !== 'seguridad'"
            [class.text-text-secondary]="activeTab() !== 'seguridad'"
            (click)="setTab('seguridad')"
          >
            Seguridad
          </button>
        }
      </div>

      <!-- Tab Content Area -->
      <app-drawer-form>
        <!-- ── TAB: PERFIL ────────────────────────────────────────── -->
        @if (activeTab() === 'perfil') {
          <div class="space-y-5">
            <!-- Identity Header -->
            <div class="flex flex-col items-center gap-3 pt-2 pb-2">
              <!-- Avatar -->
              @if (currentUser()?.avatarUrl) {
                <img
                  class="w-16 h-16 rounded-full object-cover"
                  [src]="currentUser()!.avatarUrl!"
                  [alt]="currentUser()?.name"
                />
              } @else {
                <div
                  class="w-16 h-16 rounded-full bg-brand-muted border-2 border-brand flex items-center justify-center select-none"
                >
                  <span class="text-xl font-bold text-brand">{{ currentUser()?.initials }}</span>
                </div>
              }

              <!-- Name + Role badge -->
              <div class="text-center space-y-2">
                <h2 class="font-bold leading-tight text-text-primary">
                  {{ currentUser()?.name }}
                </h2>
                @if (currentUser()?.role === 'admin') {
                  <span
                    class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border text-brand bg-brand-muted border-brand"
                  >
                    <app-icon name="shield" [size]="11" />Administrador
                  </span>
                }
                @if (currentUser()?.role === 'secretaria') {
                  <span
                    class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border text-text-secondary bg-base border-border-default"
                  >
                    <app-icon name="briefcase" [size]="11" />Secretaria
                  </span>
                }
                @if (currentUser()?.role === 'instructor') {
                  <span
                    class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border text-text-secondary bg-base border-border-default"
                  >
                    <app-icon name="car" [size]="11" />Instructor
                  </span>
                }
                @if (currentUser()?.role === 'alumno') {
                  <span
                    class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border text-text-secondary bg-base border-border-default"
                  >
                    <app-icon name="graduation-cap" [size]="11" />Alumno
                  </span>
                }
              </div>

              <!-- Email chip -->
              <div
                class="flex items-center gap-1.5 max-w-full overflow-hidden px-3 py-1.5 rounded-full bg-base border border-border-default"
              >
                <app-icon name="mail" [size]="12" class="text-text-muted shrink-0" />
                <span class="text-xs text-text-muted truncate">{{ currentUser()?.email }}</span>
              </div>
            </div>

            <!-- Info contextual -->
            <div class="grid grid-cols-2 gap-3">
              <app-stat-box
                label="Sede"
                [value]="branchLabel()"
                icon="map-pin"
                variant="surface"
                [compact]="true"
              />
              <app-stat-box
                label="Estado"
                [value]="currentUser()?.isActive !== false ? 'Activo' : 'Inactivo'"
                icon="circle-check"
                [variant]="currentUser()?.isActive !== false ? 'success' : 'error'"
                [compact]="true"
              />
            </div>

            <div class="border-t border-border-subtle"></div>

            <!-- Cambiar Contraseña (collapsible) -->
            <div class="rounded-xl border border-border-default overflow-hidden">
              <button
                type="button"
                class="w-full flex items-center justify-between p-4 text-sm font-semibold text-text-primary hover:bg-base transition-colors cursor-pointer"
                (click)="togglePasswordForm()"
              >
                <div class="flex items-center gap-2">
                  <app-icon name="lock" [size]="14" class="text-text-muted" />
                  <span>Cambiar Contraseña</span>
                </div>
                <app-icon
                  [name]="showPasswordForm() ? 'chevron-up' : 'chevron-down'"
                  [size]="14"
                  class="text-text-muted"
                />
              </button>
              @if (showPasswordForm()) {
                <div class="px-4 pt-4 pb-4 space-y-3 border-t border-border-subtle">
                  <div class="space-y-1">
                    <label class="text-xs font-semibold text-text-muted">Nueva Contraseña</label>
                    <input
                      type="password"
                      class="w-full rounded-lg border border-border-default bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-brand"
                      [(ngModel)]="newPassword"
                      (ngModelChange)="markDirty()"
                      placeholder="Min. 6 caracteres"
                    />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-semibold text-text-muted"
                      >Confirmar Contraseña</label
                    >
                    <input
                      type="password"
                      class="w-full rounded-lg border border-border-default bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-brand"
                      [(ngModel)]="confirmPassword"
                      (ngModelChange)="markDirty()"
                      placeholder="Repite tu contraseña"
                    />
                  </div>
                  <button
                    type="button"
                    class="btn-primary w-full py-2 text-sm"
                    [disabled]="
                      isSaving() || newPassword().length < 6 || newPassword() !== confirmPassword()
                    "
                    (click)="updatePassword()"
                  >
                    {{ isSaving() ? 'Actualizando...' : 'Cambiar Contraseña' }}
                  </button>
                </div>
              }
            </div>
          </div>
        }

        <!-- ── TAB: CONFIGURACIONES ──────────────────────────────── -->
        @if (activeTab() === 'config') {
          <div class="space-y-5">
            <h3 class="font-bold text-text-primary">Apariencia y Visualización</h3>

            <!-- Theme cycle -->
            <div
              class="flex items-center justify-between rounded-xl bg-base p-4 border border-border-default"
            >
              <div class="space-y-0.5">
                <p class="text-sm font-semibold text-text-primary">Modo Oscuro</p>
                <p class="text-xs text-text-muted">Cambia la paleta de colores del sistema</p>
              </div>
              <button
                type="button"
                class="cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-surface hover:bg-subtle text-text-secondary"
                (click)="theme.cycleColorMode($event)"
              >
                <app-icon [name]="theme.darkMode() ? 'sun' : 'moon'" [size]="16" />
              </button>
            </div>

            <!-- Website Landing Config card -->
            <div class="rounded-xl bg-base p-4 border border-border-default space-y-3">
              <div class="space-y-0.5">
                <p class="text-sm font-semibold text-text-primary">Landing Pages en Caliente</p>
                <p class="text-xs text-text-muted">
                  Personaliza la web promocional y tarifas de venta en vivo
                </p>
              </div>
              <button
                type="button"
                class="w-full cursor-pointer flex items-center justify-center gap-2 rounded-lg border border-brand bg-brand-muted py-2 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-brand-text"
                (click)="navigateToConfigWeb()"
              >
                <app-icon name="globe" [size]="14" />
                <span>Ir al Editor Visual de Sede ↗</span>
              </button>
            </div>

            <!-- Horarios Config card -->
            @if (isAdmin()) {
              <div class="rounded-xl bg-base p-4 border border-border-default space-y-3">
                <div class="space-y-0.5">
                  <p class="text-sm font-semibold text-text-primary">Grilla Horaria Base</p>
                  <p class="text-xs text-text-muted">
                    Configura la estructura matemática de los bloques de horarios
                  </p>
                </div>
                <button
                  type="button"
                  class="w-full cursor-pointer flex items-center justify-center gap-2 rounded-lg border border-border-default bg-surface py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-subtle"
                  (click)="abrirGeneradorHorario()"
                >
                  <app-icon name="calendar-clock" [size]="14" />
                  <span>Generar Bloques Horarios</span>
                </button>
              </div>
            }

            <!-- Branch details and switcher -->
            @if (isAdmin()) {
              <div class="rounded-xl bg-base p-4 border border-border-default space-y-3">
                <div class="space-y-0.5">
                  <p class="text-sm font-semibold text-text-primary">Conmutar Sede Activa</p>
                  <p class="text-xs text-text-muted">
                    Cambia rápidamente el filtro global de la autoescuela
                  </p>
                </div>
                <div class="space-y-2">
                  @for (branch of branchFacade.branches(); track branch.id) {
                    <button
                      type="button"
                      class="w-full flex items-center justify-between rounded-lg p-2.5 text-xs font-medium border cursor-pointer transition-colors"
                      [class.bg-brand-muted]="branchFacade.selectedBranchId() === branch.id"
                      [class.border-brand]="branchFacade.selectedBranchId() === branch.id"
                      [class.text-brand]="branchFacade.selectedBranchId() === branch.id"
                      [class.bg-surface]="branchFacade.selectedBranchId() !== branch.id"
                      [class.border-border-default]="branchFacade.selectedBranchId() !== branch.id"
                      [class.text-text-secondary]="branchFacade.selectedBranchId() !== branch.id"
                      (click)="branchFacade.selectBranch(branch.id)"
                    >
                      <span>{{ branch.name }}</span>
                      @if (branchFacade.selectedBranchId() === branch.id) {
                        <app-icon name="check" [size]="14" />
                      } @else if (branch.hasProfessional) {
                        <span
                          class="text-[9px] px-1.5 py-0.5 rounded bg-brand text-brand-text font-bold uppercase"
                          >Pro</span
                        >
                      }
                    </button>
                  }
                  <button
                    type="button"
                    class="w-full flex items-center justify-between rounded-lg p-2.5 text-xs font-medium border cursor-pointer transition-colors"
                    [class.bg-brand-muted]="branchFacade.selectedBranchId() === null"
                    [class.border-brand]="branchFacade.selectedBranchId() === null"
                    [class.text-brand]="branchFacade.selectedBranchId() === null"
                    [class.bg-surface]="branchFacade.selectedBranchId() !== null"
                    [class.border-border-default]="branchFacade.selectedBranchId() !== null"
                    [class.text-text-secondary]="branchFacade.selectedBranchId() !== null"
                    (click)="branchFacade.selectBranch(null)"
                  >
                    <span>Todas las escuelas</span>
                    @if (branchFacade.selectedBranchId() === null) {
                      <app-icon name="check" [size]="14" />
                    }
                  </button>
                </div>
              </div>
            }
          </div>
        }

        <!-- ── TAB: SEGURIDAD (SOLO ADMIN) ────────────────────────── -->
        @if (activeTab() === 'seguridad' && isAdmin()) {
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="font-bold text-text-primary">Historial de Auditoría</h3>
              <button
                type="button"
                class="cursor-pointer flex items-center gap-1 rounded-lg border border-border-default bg-surface hover:bg-subtle px-3 py-1.5 text-xs font-semibold text-text-secondary"
                (click)="navigateToAuditoria()"
              >
                <app-icon name="shield-check" [size]="12" />
                <span>Ver todos los Logs ↗</span>
              </button>
            </div>
            <p class="text-xs text-text-muted leading-relaxed">
              El log registra todas las operaciones delicadas ejecutadas por las secretarias (crear,
              editar, eliminar) con su respectiva marca de tiempo, dirección IP y el cambio
              realizado en español legible.
            </p>
            <div
              class="rounded-xl bg-base p-4 border border-border-default text-center text-xs text-text-muted py-6"
            >
              <app-icon
                name="lock-keyhole"
                class="mx-auto text-text-muted mb-2 block"
                [size]="20"
              />
              <span>Acceso seguro administrado por roles RLS</span>
            </div>
          </div>
        }

        <!-- Footer action -->
        <ng-container ngProjectAs="[drawer-form-footer]">
          <button type="button" class="btn-secondary" (click)="closeDrawer()">Cerrar</button>
        </ng-container>
      </app-drawer-form>
    </div>
  `,
  styles: [
    `
      .ajustes-container {
        height: 100%;
        display: flex;
        flex-direction: column;
      }
    `,
  ],
})
export class AjustesDrawerComponent {
  protected readonly auth = inject(AuthFacade);
  protected readonly branchFacade = inject(BranchFacade);
  protected readonly theme = inject(ThemeService);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly activeTab = signal<'perfil' | 'config' | 'seguridad'>('perfil');
  protected readonly isSaving = signal(false);
  protected readonly isDirty = signal(false);
  protected readonly showPasswordForm = signal(false);

  protected readonly currentUser = this.auth.currentUser;
  protected readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');

  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');

  protected readonly branchLabel = computed(() => {
    const branchId = this.currentUser()?.branchId;
    if (!branchId) return 'Todas';
    const branch = this.branchFacade.branches().find((b) => b.id === branchId);
    return branch?.name ?? 'Asignada';
  });

  setTab(tab: 'perfil' | 'config' | 'seguridad'): void {
    this.activeTab.set(tab);
  }

  togglePasswordForm(): void {
    this.showPasswordForm.update((v) => !v);
  }

  markDirty(): void {
    this.isDirty.set(true);
    // Configura la acción del drawer para requerir confirmación
    this.layoutDrawer.setActions([
      {
        label: 'Guardar',
        icon: 'save',
        primary: true,
        action: () => {},
      },
    ]);
  }

  navigateToConfigWeb(): void {
    this.layoutDrawer.close();
    const role = this.currentUser()?.role;
    void this.router.navigate([`/app/${role}/configuracion-web`]);
  }

  abrirGeneradorHorario(): void {
    this.layoutDrawer.push(ConfiguradorHorariosDrawerComponent, 'Horarios Base', 'calendar-clock');
  }

  navigateToAuditoria(): void {
    this.layoutDrawer.close();
    void this.router.navigate(['/app/admin/auditoria']);
  }

  async updatePassword(): Promise<void> {
    if (this.newPassword() !== this.confirmPassword()) {
      this.toast.error('Las contraseñas no coinciden.');
      return;
    }
    this.isSaving.set(true);
    try {
      const { error } = await this.auth.updatePassword(this.newPassword());
      if (error) {
        this.toast.error(error.message || 'Error al actualizar contraseña.');
      } else {
        this.toast.success('Contraseña actualizada correctamente.');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.isDirty.set(false);
        this.showPasswordForm.set(false);
        this.layoutDrawer.setActions([]);
      }
    } catch (err: any) {
      this.toast.error('Hubo un error al procesar el cambio.');
    } finally {
      this.isSaving.set(false);
    }
  }

  closeDrawer(): void {
    this.layoutDrawer.close();
  }
}
