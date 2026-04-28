import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { IconComponent } from '@shared/components/icon/icon.component';
import { InstructorAlumnosFacade } from '@core/facades/instructor-alumnos.facade';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';

const AVATAR_PALETTES = [
  { bg: 'linear-gradient(135deg,#6366f1,#8b5cf6)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#0ea5e9,#06b6d4)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#10b981,#059669)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#f59e0b,#ef4444)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#ec4899,#db2777)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#14b8a6,#0891b2)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#a855f7,#6366f1)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#f97316,#ef4444)', text: '#fff' },
];

function avatarPalette(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}

@Component({
  selector: 'app-student-drawer-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, TagModule, IconComponent, SkeletonBlockComponent, DrawerContentLoaderComponent],
  template: `
    <app-drawer-content-loader>
      <ng-template #skeletons>
        <div class="flex flex-col gap-5 p-6">
          <div class="flex items-center gap-4">
            <app-skeleton-block variant="circle" width="64px" height="64px" />
            <div class="flex flex-col gap-2 flex-1">
              <app-skeleton-block variant="text" width="60%" height="18px" />
              <app-skeleton-block variant="text" width="40%" height="14px" />
            </div>
          </div>
          <app-skeleton-block variant="text" width="100%" height="80px" />
          <app-skeleton-block variant="text" width="100%" height="100px" />
        </div>
      </ng-template>
      <ng-template #content>
      @if (facade.activeStudent(); as detail) {
        <!-- Avatar + estado -->
        <div class="flex items-center gap-4">
          <div
            class="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 shadow-lg"
            [style]="'background:' + getPalette(detail.name).bg + '; color:' + getPalette(detail.name).text"
          >{{ initials(detail.name) }}</div>
          <div>
            <p class="font-bold text-lg" style="color: var(--text-primary)">{{ detail.name }}</p>
            <p class="text-sm mb-1" style="color: var(--text-muted)">{{ detail.rut }}</p>
            <p-tag [value]="detail.statusLabel" [severity]="$any(detail.statusColor)" />
          </div>
        </div>

        <!-- Contacto -->
        <div class="space-y-1">
          <p class="text-xs font-bold uppercase tracking-wider mb-2" style="color: var(--text-muted)">Contacto</p>
          @if (detail.phone) {
            <a [href]="'tel:' + detail.phone" class="drawer-contact-link">
              <span class="drawer-contact-link__icon"><app-icon name="phone" [size]="15" /></span>
              {{ detail.phone }}
            </a>
          }
          @if (detail.email) {
            <a [href]="'mailto:' + detail.email" class="drawer-contact-link">
              <span class="drawer-contact-link__icon"><app-icon name="mail" [size]="15" /></span>
              <span class="break-all">{{ detail.email }}</span>
            </a>
          }
        </div>

        <!-- Progreso -->
        <div>
          <p class="text-xs font-bold uppercase tracking-wider mb-3" style="color: var(--text-muted)">Progreso</p>
          <div class="rounded-xl p-4 space-y-4" style="background: var(--surface-elevated); border: 1px solid var(--border-subtle)">
            <div>
              <span class="block text-xs mb-0.5" style="color: var(--text-muted)">Curso</span>
              <span class="text-sm font-semibold" style="color: var(--text-primary)">{{ detail.courseName }}</span>
            </div>
            <!-- Práctica -->
            <div>
              <div class="flex justify-between text-xs mb-1.5">
                <span style="color: var(--text-secondary)">Práctica · {{ detail.practiceProgress }}/{{ detail.totalSessions }} clases</span>
                <b style="color: var(--color-brand)">{{ detail.practicePercent }}%</b>
              </div>
              <div class="w-full rounded-full h-2" style="background: var(--color-divider)">
                <div class="h-2 rounded-full transition-all duration-500"
                  [style]="'width:' + detail.practicePercent + '%; background:' + getPalette(detail.name).bg"></div>
              </div>
            </div>
            <!-- Teoría -->
            <div>
              <div class="flex justify-between text-xs mb-1.5">
                <span style="color: var(--text-secondary)">Asistencia Teórica</span>
                <b style="color: var(--color-success)">{{ detail.theoryPercent }}%</b>
              </div>
              <div class="w-full rounded-full h-2" style="background: var(--color-divider)">
                <div class="h-2 rounded-full transition-all duration-500"
                  [style]="'width:' + detail.theoryPercent + '%; background: var(--color-success)'"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Próxima clase -->
        @if (detail.nextClassDate) {
          <div class="flex items-center gap-3 p-3.5 rounded-xl" style="background: var(--color-brand-muted); border: 1px solid color-mix(in sRGB, var(--color-brand) 20%, transparent)">
            <div class="flex items-center justify-center w-9 h-9 rounded-lg shrink-0" style="background: var(--color-brand); color: #fff">
              <app-icon name="calendar-clock" [size]="16" />
            </div>
            <div>
              <p class="text-xs font-semibold" style="color: var(--color-brand)">Próxima Clase</p>
              <p class="text-sm font-bold" style="color: var(--text-primary)">
                {{ detail.nextClassDate | date: "EEEE d 'de' MMMM 'a las' HH:mm" }}
              </p>
            </div>
          </div>
        }

        <!-- CTA -->
        <a
          [routerLink]="['/app/instructor/alumnos', detail.studentId, 'ficha']"
          class="btn btn-primary w-full justify-center"
        >
          <app-icon name="file-text" [size]="18" />
          Ver Ficha Técnica Completa
        </a>
      }
      </ng-template>
    </app-drawer-content-loader>
  `,
  styles: [`
    .drawer-contact-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 0.875rem;
      color: var(--text-primary);
      text-decoration: none;
      transition: background 0.15s;
    }
    .drawer-contact-link:hover { background: var(--surface-elevated); }
    .drawer-contact-link__icon {
      display: flex; align-items: center; justify-content: center;
      width: 30px; height: 30px;
      border-radius: 8px;
      background: var(--color-brand-muted);
      color: var(--color-brand);
      flex-shrink: 0;
    }
  `]
})
export class StudentDrawerDetailComponent {
  public facade = inject(InstructorAlumnosFacade);

  getPalette = (name: string) => avatarPalette(name);
  initials   = (name: string) => name.split(' ').slice(0, 2).map(n => n[0]).join('');
}
