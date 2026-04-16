import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { formatCLP } from '@core/utils/date.utils';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { SectionHeroAction, SectionHeroChip } from '@core/models/ui/section-hero.model';
import type {
  CierrePayload,
  EgresoRow,
  IngresoRow,
} from '@core/models/ui/cuadratura.model';

const DENOMINACIONES = [
  { key: 'bill20000', label: 'Billetes de $20.000', tipo: 'billete' },
  { key: 'bill10000', label: 'Billetes de $10.000', tipo: 'billete' },
  { key: 'bill5000', label: 'Billetes de $5.000', tipo: 'billete' },
  { key: 'bill2000', label: 'Billetes de $2.000', tipo: 'billete' },
  { key: 'bill1000', label: 'Billetes de $1.000', tipo: 'billete' },
  { key: 'coin500', label: 'Monedas de $500', tipo: 'moneda' },
  { key: 'coin100', label: 'Monedas de $100', tipo: 'moneda' },
  { key: 'coin50', label: 'Monedas de $50', tipo: 'moneda' },
  { key: 'coin10', label: 'Monedas de $10', tipo: 'moneda' },
];

const BILLETES = DENOMINACIONES.filter((d) => d.tipo === 'billete');
const MONEDAS = DENOMINACIONES.filter((d) => d.tipo === 'moneda');

@Component({
  selector: 'app-cuadratura-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent, SectionHeroComponent],
  template: `
    <div 
      class="bento-grid p-6 pb-12"
      [class.items-start]="!layoutDrawer.isOpen()"
      [class.force-compact]="layoutDrawer.isOpen()"
    >
      <!-- ── Header ─────────────────────────────────────────────────────────── -->
      <app-section-hero
        title="Cuadratura Diaria"
        [contextLine]="fechaHoy()"
        [chips]="heroChips()"
        [actions]="heroActions()"
        (actionClick)="onHeroAction($event)"
      />

      <!-- ─ Columna izquierda (2/3): Tablas de Registro de Sistema ─────────────────── -->
      <div class="bento-feature flex flex-col gap-6">
        
        <!-- REGISTRO DE INGRESOS -->
        <div class="bento-card p-0 flex flex-col overflow-hidden shadow-sm">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 border-b border-border-muted/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
              <app-icon name="trending-up" [size]="20" color="var(--color-primary)" />
            </div>
            <div>
              <h2 class="text-base font-bold text-text-primary">Registro de Ingresos</h2>
              <p class="text-[13px] text-text-muted mt-0.5">Detalle de pagos y boletas recibidos en el día.</p>
            </div>
          </div>
          <button
            class="btn-primary flex items-center gap-2 text-[13px] px-5 py-2.5 rounded-xl shrink-0 transition-transform active:scale-[0.98] shadow-sm"
            data-llm-action="agregar-ingreso-cuadratura"
            [disabled]="cajaYaCerrada()"
            [style.opacity]="cajaYaCerrada() ? '0.5' : '1'"
            aria-label="Agregar nuevo ingreso"
            (click)="abrirIngreso.emit()"
          >
            <app-icon name="plus" [size]="16" />
            <span class="font-bold">Agregar Ingreso</span>
          </button>
        </div>

        <!-- Tabla (Desktop) / Cards (Mobile) -->
        <div class="flex-1 overflow-x-auto" style="container-type: inline-size;">
          <!-- Vista Desktop (Table) -->
          <div class="hidden sm:block" [class.!hidden]="layoutDrawer.isOpen()">
            <!-- Header Columnas -->
            <div class="px-6 py-3 grid items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-text-muted bg-bg-subtle border-y border-border-muted/50"
                 style="grid-template-columns: 80px 1fr 85px 85px 85px 85px 100px 36px">
               <span>N° Boleta</span>
               <span>Glosa / Alumno</span>
               <span class="text-right">Clase B</span>
               <span class="text-right">Clase A</span>
               <span class="text-right">Sensom.</span>
               <span class="text-right">Otros</span>
               <span class="text-right text-text-primary">Total</span>
               <span></span>
            </div>

            <!-- Filas -->
            @if (isLoading()) {
              <div class="divide-y divide-border-muted/50">
                @for (row of [1, 2, 3]; track row) {
                  <div class="px-6 py-4 grid gap-2 items-center" style="grid-template-columns: 80px 1fr 85px 85px 85px 85px 100px 36px">
                    <app-skeleton-block variant="text" width="60px" height="14px" />
                    <app-skeleton-block variant="text" width="80%" height="14px" />
                    <app-skeleton-block variant="text" width="50px" height="14px" class="ml-auto" />
                    <app-skeleton-block variant="text" width="50px" height="14px" class="ml-auto" />
                    <app-skeleton-block variant="text" width="50px" height="14px" class="ml-auto" />
                    <app-skeleton-block variant="text" width="50px" height="14px" class="ml-auto" />
                    <app-skeleton-block variant="text" width="70px" height="18px" class="ml-auto" />
                    <div></div>
                  </div>
                }
              </div>
            } @else if (pagosHoy().length === 0) {
              <div class="px-6 py-20 flex flex-col items-center justify-center text-center">
                <div class="w-14 h-14 rounded-2xl bg-bg-subtle flex items-center justify-center mb-4 border border-border-muted/50 shadow-sm">
                  <app-icon name="receipt" [size]="24" color="var(--text-muted)" />
                </div>
                <h3 class="text-sm font-bold text-text-primary">No hay ingresos registrados</h3>
                <p class="text-[13px] text-text-muted mt-1.5 max-w-sm">
                  Aún no se han registrado pagos, transferencias o boletas en la caja de hoy.
                </p>
              </div>
            } @else {
              <div class="divide-y divide-border-muted/50">
                @for (fila of pagosHoy(); track fila.id) {
                  <div class="px-6 py-3.5 grid gap-2 items-center hover:bg-bg-subtle transition-colors group"
                       style="grid-template-columns: 80px 1fr 85px 85px 85px 85px 100px 36px">
                    <span class="text-[13px] font-mono font-medium text-text-secondary">
                      {{ fila.nBoleta ?? '—' }}
                    </span>
                    <span class="text-[13px] font-semibold text-text-primary truncate">
                      {{ fila.glosa }}
                    </span>
                    <span class="text-[13px] text-right text-text-secondary tabular-nums">
                      {{ fila.claseB > 0 ? fila.claseB.toLocaleString('es-CL') : '—' }}
                    </span>
                    <span class="text-[13px] text-right text-text-secondary tabular-nums">
                      {{ fila.claseA > 0 ? fila.claseA.toLocaleString('es-CL') : '—' }}
                    </span>
                    <span class="text-[13px] text-right text-text-secondary tabular-nums">
                      {{ fila.sence > 0 ? fila.sence.toLocaleString('es-CL') : '—' }}
                    </span>
                    <span class="text-[13px] text-right text-text-secondary tabular-nums">
                      {{ fila.otros > 0 ? fila.otros.toLocaleString('es-CL') : '—' }}
                    </span>
                    <span class="text-[14px] text-right font-black text-text-primary tabular-nums tracking-tight">
                      {{ clp(fila.total) }}
                    </span>
                    <button
                      class="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted opacity-0 group-hover:opacity-100 hover:bg-state-error/10 hover:text-state-error transition-all focus-visible:opacity-100 ml-auto"
                      [disabled]="cajaYaCerrada()"
                      [attr.aria-label]="'Eliminar ingreso ' + (fila.nBoleta ?? fila.id)"
                      (click)="onEliminarIngreso(fila, $event)"
                    >
                      <app-icon name="trash-2" [size]="15" />
                    </button>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Vista Mobile (Cards) se activa por Container Query o Drawer abierto -->
          <div class="sm:hidden flex flex-col gap-3 p-4" [class.!flex]="layoutDrawer.isOpen()">
            @if (isLoading()) {
              @for (i of [1,2]; track i) {
                <div class="p-4 rounded-xl border border-border-muted/50 flex flex-col gap-3">
                  <app-skeleton-block variant="text" width="60%" height="16px" />
                  <div class="flex justify-between">
                    <app-skeleton-block variant="text" width="30%" height="14px" />
                    <app-skeleton-block variant="text" width="30%" height="14px" />
                  </div>
                </div>
              }
            } @else {
              @for (fila of pagosHoy(); track fila.id) {
                <div class="card-mobile-ingreso">
                  <div class="flex justify-between items-start mb-2">
                    <div class="flex flex-col">
                      <span class="text-[11px] font-bold text-text-muted uppercase tracking-wider">Boleta {{ fila.nBoleta ?? 'S/N' }}</span>
                      <span class="text-[14px] font-bold text-text-primary">{{ fila.glosa }}</span>
                    </div>
                    <button
                      class="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-state-error transition-colors"
                      [disabled]="cajaYaCerrada()"
                      (click)="onEliminarIngreso(fila, $event)"
                    >
                      <app-icon name="trash-2" [size]="14" />
                    </button>
                  </div>
                  <div class="grid grid-cols-2 gap-y-2 mt-2 pt-2 border-t border-border-muted/30">
                    <div class="flex flex-col">
                      <span class="text-[10px] text-text-muted uppercase">Conceptos</span>
                      <div class="flex flex-wrap gap-1 mt-0.5">
                        @if (fila.claseB > 0) { <span class="badge-mini">B</span> }
                        @if (fila.claseA > 0) { <span class="badge-mini">A</span> }
                        @if (fila.sence > 0) { <span class="badge-mini">SIM</span> }
                        @if (fila.otros > 0) { <span class="badge-mini">+</span> }
                      </div>
                    </div>
                    <div class="flex flex-col items-end">
                      <span class="text-[10px] text-text-muted uppercase">Total</span>
                      <span class="text-[16px] font-black text-text-primary">{{ clp(fila.total) }}</span>
                    </div>
                  </div>
                </div>
              }
            }
          </div>
        </div>

        <!-- Footer total Ingresos -->
        <div class="px-6 py-5 flex items-center justify-between border-t border-border-muted/50 bg-bg-surface mt-auto">
          <span class="text-[11px] font-bold uppercase tracking-widest text-text-muted">
            Mostrando {{ pagosHoy().length }} ingresos
          </span>
          <div class="flex items-center gap-4 bg-brand/5 px-4 py-2 rounded-xl border border-brand/10">
            <span class="text-[11px] font-black uppercase tracking-widest opacity-80" style="color: var(--color-primary)">
              Total Día
            </span>
            <span class="text-[22px] font-black tabular-nums tracking-tight" style="color: var(--color-primary)">
              {{ clp(totalIngresosHoy()) }}
            </span>
          </div>
        </div>
        </div>
        
        <!-- REGISTRO DE EGRESOS (Movido a la izquierda) -->
        <div class="bento-card p-0 flex flex-col overflow-hidden shadow-sm">
          <div class="flex items-center justify-between px-6 py-4 border-b border-border-muted/50">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-state-warning/10 flex items-center justify-center shrink-0">
                <app-icon name="trending-down" [size]="16" color="var(--state-warning)" />
              </div>
              <h2 class="text-[15px] font-bold text-text-primary">Egresos / Retiros</h2>
            </div>
            <button
              class="btn-primary flex items-center gap-2 text-[13px] px-5 py-2.5 rounded-xl shrink-0 transition-transform active:scale-[0.98] shadow-sm"
              data-llm-action="agregar-egreso-cuadratura"
              [disabled]="cajaYaCerrada()"
              [style.opacity]="cajaYaCerrada() ? '0.5' : '1'"
              aria-label="Agregar nuevo egreso"
              (click)="abrirEgreso.emit()"
            >
              <app-icon name="plus" [size]="16" />
              <span class="font-bold">Agregar Egreso</span>
            </button>
          </div>

          <div class="px-6 py-2 grid grid-cols-[1fr_80px_24px] gap-3 text-[11px] font-bold uppercase tracking-widest text-text-muted bg-bg-subtle border-b border-border-muted/50">
            <span>Motivo</span>
            <span class="text-right">Monto</span>
            <span></span>
          </div>

          @if (isLoading()) {
            <div class="divide-y divide-border-muted/50">
              @for (i of [1, 2]; track i) {
                <div class="px-6 py-3.5 grid grid-cols-[1fr_80px_24px] gap-3 items-center">
                  <app-skeleton-block variant="text" width="80%" height="14px" />
                  <app-skeleton-block variant="text" width="60px" height="14px" class="ml-auto" />
                  <div></div>
                </div>
              }
            </div>
          } @else if (gastosHoy().length === 0) {
            <div class="px-6 py-10 flex flex-col items-center justify-center text-center">
              <p class="text-[13px] text-text-muted">Sin egresos registrados hoy.</p>
            </div>
          } @else {
            <div class="divide-y divide-border-muted/50">
              @for (egreso of gastosHoy(); track egreso.id + egreso.tipo) {
                <div class="px-6 py-3 grid grid-cols-[1fr_80px_24px] gap-3 items-center group hover:bg-bg-subtle transition-colors">
                  <span class="text-[13px] font-medium text-text-primary truncate">
                    {{ egreso.descripcion }}
                  </span>
                  <span class="text-[13px] text-right font-bold text-text-primary tabular-nums">
                    {{ egreso.monto.toLocaleString('es-CL') }}
                  </span>
                  <button
                    class="flex items-center justify-center w-7 h-7 rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:bg-state-error/10 hover:text-state-error transition-all focus-visible:opacity-100"
                    [disabled]="cajaYaCerrada()"
                    (click)="onEliminarEgreso(egreso, $event)"
                  >
                    <app-icon name="x" [size]="14" />
                  </button>
                </div>
              }
            </div>
          }

          <div class="px-6 py-4 flex items-center justify-between border-t border-border-muted/50 bg-bg-surface mt-auto">
            <span class="text-[11px] font-bold uppercase tracking-widest text-text-muted">Total Egresos</span>
            <span class="text-[17px] font-black tabular-nums tracking-tight" style="color: var(--state-warning)">
              {{ clp(totalEgresosHoy()) }}
            </span>
          </div>
        </div>
        
      </div>

      <!-- ─ Columna derecha (1/3): Panel Interactivo (Sticky Checkout) ───────────────────────── -->
      <div class="bento-tall border-t-[3px] border-t-brand rounded-2xl shadow-sm sticky top-6 self-start flex flex-col">
        
        <!-- ================= ARQUEO FÍSICO Y CIERRE (Checkout Ledger) ================= -->
        <div class="bento-card p-0 flex flex-col overflow-hidden shadow-sm">
          <!-- Titular principal -->
          <div class="px-6 py-5 border-b border-border-muted/50 bg-bg-surface">
            <div class="flex items-center gap-3 mb-1.5">
              <div class="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                <app-icon name="wallet" [size]="16" color="var(--color-primary)" />
              </div>
              <h2 class="text-[16px] font-bold text-text-primary">Arqueo y Cierre Operativo</h2>
            </div>
            <p class="text-[13px] text-text-muted pl-11">
              Conciliación entre lo esperado por el sistema y el efectivo declarado.
            </p>
          </div>

          <!-- 1. Formulación Esperada (System Math) -->
          <div class="px-6 py-5 bg-brand/5 border-b border-brand/10 flex flex-col gap-2.5">
            <div class="flex items-center justify-between text-[13px] font-semibold text-text-secondary">
               <span>Ingresos de Sistema</span>
               <span class="tabular-nums" style="color: var(--color-primary)">{{ clp(totalIngresosHoy()) }}</span>
            </div>
            <div class="flex items-center justify-between text-[13px] font-semibold text-text-secondary">
               <span>Egresos / Retiros (-)</span>
               <span class="tabular-nums" style="color: var(--state-warning)">{{ clp(totalEgresosHoy()) }}</span>
            </div>
            <div class="mt-1 pt-3 border-t border-brand/10 flex items-center justify-between">
               <span class="text-[11px] font-black uppercase tracking-widest" style="color: var(--color-primary)">Debe Haber en Caja</span>
               <span class="text-[17px] font-black text-text-primary tabular-nums tracking-tight">{{ clp(saldoTeorico()) }}</span>
            </div>
          </div>

          <!-- 2. Arqueo Form (Billetes y Monedas) -->
          <div class="px-6 py-6 grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-8 bg-bg-surface">
            <!-- Billetes -->
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between border-b border-border-muted/50 pb-2 mb-1">
                <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">Billetes</span>
                <app-icon name="banknote" [size]="14" color="var(--text-muted)" class="opacity-50" />
              </div>
              @for (billete of billetes(); track billete.key) {
                <div class="flex items-center justify-between group">
                  <span class="text-[13px] font-semibold text-text-secondary group-hover:text-text-primary transition-colors cursor-default">
                    {{ billete.label.replace('Billetes de ', '') }}
                  </span>
                  <div class="flex items-center gap-2.5">
                    <span class="text-[11px] text-text-muted font-bold opacity-50">×</span>
                    <input
                      type="number"
                      min="0"
                      class="w-[76px] h-9 text-[14px] font-black text-right px-3 py-1 rounded-xl bg-bg-subtle border border-border-muted focus:bg-bg-surface focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all tabular-nums hover:border-text-muted"
                      [value]="cantidades()[billete.key] || ''"
                      placeholder="0"
                      [disabled]="cajaYaCerrada()"
                      (input)="onCantidadChange(billete.key, $event)"
                      (focus)="selectAll($event)"
                    />
                  </div>
                </div>
              }
            </div>

            <!-- Monedas -->
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between border-b border-border-muted/50 pb-2 mb-1">
                <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">Monedas</span>
                <app-icon name="circle" [size]="14" color="var(--text-muted)" class="opacity-50" />
              </div>
              @for (moneda of monedas(); track moneda.key) {
                <div class="flex items-center justify-between group">
                  <span class="text-[13px] font-semibold text-text-secondary group-hover:text-text-primary transition-colors cursor-default">
                    {{ moneda.label.replace('Monedas de ', '') }}
                  </span>
                  <div class="flex items-center gap-2.5">
                    <span class="text-[11px] text-text-muted font-bold opacity-50">×</span>
                    <input
                      type="number"
                      min="0"
                      class="w-[76px] h-9 text-[14px] font-black text-right px-3 py-1 rounded-xl bg-bg-subtle border border-border-muted focus:bg-bg-surface focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all tabular-nums hover:border-text-muted"
                      [value]="cantidades()[moneda.key] || ''"
                      placeholder="0"
                      [disabled]="cajaYaCerrada()"
                      (input)="onCantidadChange(moneda.key, $event)"
                      (focus)="selectAll($event)"
                    />
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- 3. Dynamic Differential Status -->
          <div class="px-6 py-5 border-y border-border-muted/50 transition-colors flex flex-col gap-3"
               [style.background]="'color-mix(in srgb, ' + colorDiferencia() + ' 8%, transparent)'">
             <div class="flex items-center justify-between">
               <span class="text-[11px] font-bold uppercase tracking-widest text-text-muted">Total Físico Arqueado</span>
               <span class="text-[16px] font-black tabular-nums" [style.color]="totalArqueo() > 0 ? 'var(--text-primary)' : 'var(--text-muted)'">
                 {{ clp(totalArqueo()) }}
               </span>
             </div>
             <div class="flex items-center justify-between">
               <span class="text-[13px] font-black uppercase tracking-widest" [style.color]="colorDiferencia()">Diferencia</span>
               <span class="text-[22px] font-black tabular-nums tracking-tighter" [style.color]="colorDiferencia()">
                  {{ diferencia() > 0 ? '+' : '' }}{{ clp(diferencia()) }}
               </span>
             </div>
          </div>

          <!-- 4. Justificación y CTAs (Fondo de Tarjeta) -->
          <div class="px-6 py-6 border-t border-border-muted/50 mt-auto flex flex-col gap-5 bg-bg-subtle/30">
            <div class="flex flex-col gap-2.5">
              <div class="flex items-center justify-between">
                <label class="text-[12px] font-bold uppercase tracking-widest" [style.color]="diferencia() !== 0 ? 'var(--state-warning)' : 'var(--text-muted)'">
                  {{ diferencia() !== 0 ? 'Justificación Obligatoria' : 'Observaciones (Opcional)' }}
                </label>
                <app-icon name="message-circle" [size]="14" color="var(--text-muted)" class="opacity-50" />
              </div>
              <textarea
                rows="2"
                class="w-full text-[13px] px-4 py-3.5 rounded-xl resize-none bg-bg-surface border border-border-muted focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-shadow placeholder:text-text-muted/60"
                placeholder="Ej: Faltan $500 por vuelto mal dado..."
                [disabled]="cajaYaCerrada()"
                [value]="notas()"
                (input)="notas.set(getInputValue($event))"
              ></textarea>
            </div>
            
            <button
               class="w-full flex items-center justify-center gap-2.5 font-bold text-[14px] py-4 rounded-xl transition-all duration-300 shadow-sm active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-brand"
               [class.btn-primary]="!cajaYaCerrada()"
               [style.background]="cajaYaCerrada() ? 'var(--bg-surface)' : ''"
               [style.border]="cajaYaCerrada() ? '1px solid var(--border-muted)' : ''"
               [style.color]="cajaYaCerrada() ? 'var(--text-muted)' : ''"
               [disabled]="cajaYaCerrada() || isSaving()"
               [style.opacity]="cajaYaCerrada() || isSaving() ? '0.7' : '1'"
               data-llm-action="cerrar-caja-guardar"
               (click)="onGuardarCierre()"
            >
               @if (isSaving()) {
                 <app-icon name="loader" [size]="18" class="animate-spin" />
                 <span class="tracking-wide">Procesando...</span>
               } @else if (cajaYaCerrada()) {
                 <app-icon name="lock" [size]="18" />
                 <span class="tracking-wide">Caja Cerrada Exitosamente</span>
               } @else {
                 <app-icon name="lock" [size]="18" />
                 <span class="tracking-wide">Validar Arqueo y Cerrar Caja</span>
               }
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .badge-mini {
      font-size: 9px;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 4px;
      background: var(--brand-muted);
      color: var(--color-primary);
      border: 1px solid color-mix(in srgb, var(--color-primary) 10%, transparent);
    }

    .card-mobile-ingreso {
      background: var(--bg-surface);
      border: 1px solid var(--border-muted);
      border-radius: 12px;
      padding: 14px;
      transition: transform 0.2s ease;
    }

    .card-mobile-ingreso:active {
      transform: scale(0.98);
      background: var(--bg-subtle);
    }

    @media (max-width: 1024px) {
      .bento-grid {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .sticky {
        position: static !important;
        width: 100%;
      }
    }

    /* Force Compact overrides (Drawer Open) */
    .force-compact.bento-grid {
      display: flex !important;
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 24px !important;
    }
    
    .force-compact.bento-grid .bento-feature {
      width: 100% !important;
    }

    .force-compact.bento-grid .sticky {
      position: static !important;
      width: 100% !important;
    }
  `,
})
export class CuadraturaContentComponent {
  // ── Inputs (datos del facade, pasados por el smart component) ─────────────
  readonly pagosHoy = input.required<IngresoRow[]>();
  readonly gastosHoy = input.required<EgresoRow[]>();
  readonly fondoInicial = input<number>(50_000);
  readonly totalIngresosHoy = input.required<number>();
  readonly totalEgresosHoy = input.required<number>();
  readonly saldoTeorico = input.required<number>();
  readonly cajaYaCerrada = input<boolean>(false);
  readonly isLoading = input<boolean>(false);
  readonly isSaving = input<boolean>(false);
  
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Outputs ───────────────────────────────────────────────────────────────
  readonly guardarCierre = output<CierrePayload>();
  readonly abrirIngreso = output<void>();
  readonly abrirEgreso = output<void>();
  readonly eliminarIngreso = output<IngresoRow>();
  readonly eliminarEgreso = output<EgresoRow>();

  // ── Estado interno del arqueo ─────────────────────────────────────────────
  protected readonly cantidades = signal<Record<string, number>>({
    bill20000: 0,
    bill10000: 0,
    bill5000: 0,
    bill2000: 0,
    bill1000: 0,
    coin500: 0,
    coin100: 0,
    coin50: 0,
    coin10: 0,
  });

  protected readonly notas = signal<string>('');

  // ── Constantes ────────────────────────────────────────────────────────────
  protected readonly billetes = signal(BILLETES);
  protected readonly monedas = signal(MONEDAS);

  // ── Computed ──────────────────────────────────────────────────────────────
  protected readonly totalArqueo = computed(() => {
    const c = this.cantidades();
    return (
      c['bill20000'] * 20_000 +
      c['bill10000'] * 10_000 +
      c['bill5000'] * 5_000 +
      c['bill2000'] * 2_000 +
      c['bill1000'] * 1_000 +
      c['coin500'] * 500 +
      c['coin100'] * 100 +
      c['coin50'] * 50 +
      c['coin10'] * 10
    );
  });

  protected readonly diferencia = computed(() => this.totalArqueo() - this.saldoTeorico());

  protected readonly colorDiferencia = computed(() => {
    const d = this.diferencia();
    if (d === 0) return 'var(--state-success)';
    if (d < 0) return 'var(--state-error)';
    return 'var(--state-warning)';
  });

  protected readonly fechaHoy = computed(() => {
    const now = new Date();
    return now.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  });

  protected readonly heroChips = computed<SectionHeroChip[]>(() => {
    if (this.cajaYaCerrada()) {
      return [{ label: 'Caja Cerrada', style: 'error', icon: 'lock' }];
    } else {
      return [{ label: 'Caja Abierta', style: 'success', icon: 'unlock' }];
    }
  });

  protected readonly heroActions = computed<SectionHeroAction[]>(() => [
    {
      id: 'ver-historial',
      label: 'Ver Historial',
      icon: 'history',
      route: '../historial-cuadraturas',
      primary: false
    },
    {
      id: 'exportar-excel',
      label: 'Exportar a Excel',
      icon: 'download',
      primary: false
    }
  ]);

  // ── Helpers de template ───────────────────────────────────────────────────
  protected readonly clp = formatCLP;

  protected onCantidadChange(key: string, event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    this.cantidades.update((prev) => ({ ...prev, [key]: isNaN(val) || val < 0 ? 0 : val }));
  }

  protected selectAll(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  protected getInputValue(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected onHeroAction(actionId: string): void {
    if (actionId === 'exportar-excel') {
      console.log('TODO: Exportar Excel');
    }
  }

  protected onEliminarIngreso(fila: IngresoRow, event: Event): void {
    event.stopPropagation();
    const confirmado = window.confirm(
      '¿Estás seguro de que deseas eliminar este movimiento?\nEsta acción no se puede deshacer y los saldos se recalcularán.',
    );
    if (confirmado) {
      this.eliminarIngreso.emit(fila);
    }
  }

  protected onEliminarEgreso(egreso: EgresoRow, event: Event): void {
    event.stopPropagation();
    const confirmado = window.confirm(
      '¿Estás seguro de que deseas eliminar este egreso?\nEsta acción no se puede deshacer.',
    );
    if (confirmado) {
      this.eliminarEgreso.emit(egreso);
    }
  }

  protected onGuardarCierre(): void {
    const c = this.cantidades();
    this.guardarCierre.emit({
      bill20000: c['bill20000'],
      bill10000: c['bill10000'],
      bill5000: c['bill5000'],
      bill2000: c['bill2000'],
      bill1000: c['bill1000'],
      coin500: c['coin500'],
      coin100: c['coin100'],
      coin50: c['coin50'],
      coin10: c['coin10'],
      notes: this.notas(),
      arqueoTotal: this.totalArqueo(),
    });
  }
}
