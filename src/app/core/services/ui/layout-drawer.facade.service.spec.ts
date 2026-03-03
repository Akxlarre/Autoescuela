import { TestBed } from '@angular/core/testing';
import { LayoutDrawerFacadeService } from './layout-drawer.facade.service';
import { LayoutDrawerService } from './layout-drawer.service';
import { Component } from '@angular/core';

@Component({ template: '' })
class DummyComponent { }

describe('LayoutDrawerFacadeService', () => {
    let facade: LayoutDrawerFacadeService;
    let serviceSpy: jasmine.SpyObj<LayoutDrawerService>;

    beforeEach(() => {
        // Create a mock for the underlying service
        serviceSpy = jasmine.createSpyObj('LayoutDrawerService', ['open', 'close', 'clear'], {
            isOpen: () => false,
            component: () => null,
            title: () => '',
            icon: () => undefined
        });

        TestBed.configureTestingModule({
            providers: [
                LayoutDrawerFacadeService,
                { provide: LayoutDrawerService, useValue: serviceSpy }
            ]
        });

        facade = TestBed.inject(LayoutDrawerFacadeService);
    });

    it('should be created', () => {
        expect(facade).toBeTruthy();
    });

    it('should call open on underlying service', () => {
        facade.open(DummyComponent, 'Unit Test', 'icon-test');
        expect(serviceSpy.open).toHaveBeenCalledWith(DummyComponent, 'Unit Test', 'icon-test');
    });

    it('should call close on underlying service', () => {
        facade.close();
        expect(serviceSpy.close).toHaveBeenCalled();
    });
});
