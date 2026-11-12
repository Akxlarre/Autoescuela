import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DmsDocPreviewDrawerComponent } from './dms-doc-preview-drawer.component';
import { DmsFacade } from '@core/facades/dms.facade';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import { SafePipe } from '@core/pipes/safe.pipe';

describe('DmsDocPreviewDrawerComponent (spec 0060-b T3.3)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('cuando falla la vista previa muestra previewDocError y botón Reintentar', () => {
    const retryPreview = vi.fn().mockResolvedValue(undefined);
    const facadeMock = {
      previewDoc: signal(null),
      previewDocLoading: signal(false),
      previewDocError: signal<string | null>('No se pudo generar enlace de vista previa'),
      retryPreview,
      closeDrawer: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [DmsDocPreviewDrawerComponent],
      providers: [
        { provide: DmsFacade, useValue: facadeMock },
        { provide: DmsViewerService, useValue: { download: vi.fn() } },
      ],
    }).overrideComponent(DmsDocPreviewDrawerComponent, {
      set: {
        imports: [SafePipe],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });

    const fixture = TestBed.createComponent(DmsDocPreviewDrawerComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    const retryBtn = fixture.nativeElement.querySelector(
      '[data-llm-action="reintentar-vista-previa"]',
    ) as HTMLButtonElement | null;

    expect(text).toContain('No se pudo generar enlace de vista previa');
    expect(retryBtn).not.toBeNull();
    retryBtn?.click();
    expect(retryPreview).toHaveBeenCalledTimes(1);
  });
});
