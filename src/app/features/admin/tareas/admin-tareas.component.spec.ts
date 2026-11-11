import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminTareasComponent } from './admin-tareas.component';
import { TasksFacade } from '@core/facades/tasks.facade';
import { AnnouncementsFacade } from '@core/facades/announcements.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutService } from '@core/services/ui/layout.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { TaskRow } from '@core/models/ui/task.model';

function makeTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: 'task-1',
    branch_id: 1,
    from_user_id: 1,
    from_role: 'admin',
    to_user_id: 2,
    to_role: 'secretary',
    type: 'task',
    subject: 'Revisar agenda',
    body: null,
    status: 'pending',
    due_date: null,
    completed_at: null,
    seen_at: null,
    seen_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    senderName: 'Admin',
    recipientName: 'Secretaria',
    replyCount: 0,
    isOverdue: false,
    ageInDays: 0,
    recipientInactive: false,
    canEdit: true,
    canChangeStatus: true,
    canDelete: false,
    ...overrides,
  };
}

describe('AdminTareasComponent — layout Caso B en fill-screen (spec 0060-b T3.6)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('el aviso de Caso B vive dentro de .bento-fill y no como hijo directo de .bento-grid', () => {
    const task = makeTask();
    TestBed.configureTestingModule({
      imports: [AdminTareasComponent],
      providers: [
        {
          provide: TasksFacade,
          useValue: {
            tasks: signal([task]).asReadonly(),
            sentTasks: signal([task]).asReadonly(),
            receivedTasks: signal([task]).asReadonly(),
            observationTasks: signal<TaskRow[]>([]).asReadonly(),
            pendingCount: signal(1).asReadonly(),
            overdueCount: signal(0).asReadonly(),
            isLoading: signal(false).asReadonly(),
            error: signal<string | null>(null).asReadonly(),
            refreshFailed: signal(true).asReadonly(),
            reintentar: vi.fn().mockResolvedValue(undefined),
            initialize: vi.fn().mockResolvedValue(undefined),
            dispose: vi.fn(),
            selectTask: vi.fn(),
            selectedTask: signal(null).asReadonly(),
          },
        },
        {
          provide: AnnouncementsFacade,
          useValue: {
            announcements: signal([]).asReadonly(),
            isLoading: signal(false).asReadonly(),
            initialize: vi.fn().mockResolvedValue(undefined),
            cancelScheduled: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: ConfirmModalService, useValue: { confirm: vi.fn().mockResolvedValue(false) } },
        {
          provide: BranchFacade,
          useValue: {
            selectedBranchId: signal(null).asReadonly(),
            branches: signal([]).asReadonly(),
          },
        },
        { provide: LayoutService, useValue: { tier: signal('desktop').asReadonly() } },
        { provide: LayoutDrawerFacadeService, useValue: { open: vi.fn(), isOpen: signal(false) } },
        {
          provide: GsapAnimationsService,
          useValue: { animateBentoGrid: vi.fn(), animateHero: vi.fn(), addCardHover: vi.fn() },
        },
      ],
    }).overrideComponent(AdminTareasComponent, {
      set: {
        imports: [],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });

    const fixture = TestBed.createComponent(AdminTareasComponent);
    (fixture.componentInstance as any).onCanalChange('tareas');
    fixture.detectChanges();

    const alertCard = fixture.nativeElement.querySelector('app-alert-card') as HTMLElement | null;
    expect(alertCard).not.toBeNull();
    expect(alertCard?.closest('.bento-fill')).not.toBeNull();
    expect(alertCard?.parentElement?.classList.contains('bento-grid')).toBe(false);
    expect(fixture.nativeElement.querySelector('.bento-grid > [role="alert"]')).toBeNull();
  });
});
