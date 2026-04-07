import { TestBed } from '@angular/core/testing';
import { LayoutDrawerFacadeService } from './layout-drawer.facade.service';
import { LayoutDrawerService } from './layout-drawer.service';
import { Component } from '@angular/core';

@Component({ template: '' })
class DummyComponent {}

describe('LayoutDrawerFacadeService', () => {
  let facade: LayoutDrawerFacadeService;
  let serviceSpy: any;

  beforeEach(() => {
    // Create a mock for the underlying service
    serviceSpy = {
      open: vi.fn(),
      close: vi.fn(),
      clear: vi.fn(),
      isOpen: () => false,
      component: () => null,
      title: () => '',
      icon: () => undefined,
    };

    TestBed.configureTestingModule({
      providers: [
        LayoutDrawerFacadeService,
        { provide: LayoutDrawerService, useValue: serviceSpy },
      ],
    });

    facade = TestBed.inject(LayoutDrawerFacadeService);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should call open on underlying service', () => {
    facade.open(DummyComponent, 'Unit Test', 'icon-test');
    expect(serviceSpy.open).toHaveBeenCalledWith(
      DummyComponent,
      'Unit Test',
      'icon-test',
      undefined,
    );
  });

  it('should call close on underlying service', () => {
    facade.close();
    expect(serviceSpy.close).toHaveBeenCalled();
  });
});
