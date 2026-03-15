import { TestBed } from '@angular/core/testing';
import { DashboardAlertsFacade } from './dashboard-alerts.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';

describe('DashboardAlertsFacade', () => {
  let facade: DashboardAlertsFacade;
  let fromSpy: jasmine.Spy;

  // Builds a chain that resolves with { data, count, error }
  const buildChain = (result: { data?: unknown; count?: number; error?: unknown }) => {
    const resolved = Promise.resolve(result);
    const chain: any = {
      select: jasmine.createSpy('select').and.returnValue(chain),
      eq: jasmine.createSpy('eq').and.returnValue(chain),
      lt: jasmine.createSpy('lt').and.returnValue(chain),
      gt: jasmine.createSpy('gt').and.returnValue(chain),
      gte: jasmine.createSpy('gte').and.returnValue(chain),
      lte: jasmine.createSpy('lte').and.returnValue(chain),
      then: (resolve: any, reject: any) => resolved.then(resolve, reject),
    };
    return chain;
  };

  beforeEach(() => {
    fromSpy = jasmine.createSpy('from');

    const supabaseMock = {
      client: { from: fromSpy },
    } as unknown as SupabaseService;

    const authMock = {
      whenReady: Promise.resolve(),
      currentUser: jasmine.createSpy().and.returnValue({ dbId: 1 }),
    } as unknown as AuthFacade;

    TestBed.configureTestingModule({
      providers: [
        DashboardAlertsFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: AuthFacade, useValue: authMock },
      ],
    });

    facade = TestBed.inject(DashboardAlertsFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should start with empty alerts', () => {
    expect(facade.activeAlerts()).toEqual([]);
    expect(facade.alertCount()).toBe(0);
  });

  describe('loadAlerts', () => {
    it('should produce alerts for expired documents and pending payments', async () => {
      let callCount = 0;
      fromSpy.and.callFake((table: string) => {
        if (table === 'alert_config') {
          return buildChain({ data: [{ alert_type: 'document_expiry', advance_days: 30 }] });
        }
        if (table === 'vehicle_documents') {
          callCount++;
          if (callCount === 1) {
            // expired docs
            return buildChain({ count: 3 });
          }
          // expiring soon
          return buildChain({ count: 2 });
        }
        if (table === 'enrollments') {
          return buildChain({ count: 5 });
        }
        return buildChain({ data: null });
      });

      await facade.loadAlerts();

      expect(facade.activeAlerts().length).toBe(3);
      expect(facade.alertCount()).toBe(3);
      expect(facade.isLoading()).toBeFalse();

      const severities = facade.activeAlerts().map((a) => a.severity);
      expect(severities).toContain('error');
      expect(severities).toContain('warning');
    });

    it('should produce no alerts when everything is clean', async () => {
      fromSpy.and.callFake((table: string) => {
        if (table === 'alert_config') {
          return buildChain({ data: [] });
        }
        return buildChain({ count: 0 });
      });

      await facade.loadAlerts();

      expect(facade.activeAlerts()).toEqual([]);
      expect(facade.alertCount()).toBe(0);
    });

    it('should set error when query fails', async () => {
      fromSpy.and.callFake(() => {
        throw new Error('DB down');
      });

      await facade.loadAlerts();

      expect(facade.error()).toBe('Error al cargar alertas');
      expect(facade.isLoading()).toBeFalse();
    });
  });
});
