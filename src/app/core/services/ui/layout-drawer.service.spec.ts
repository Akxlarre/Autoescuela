import { TestBed } from '@angular/core/testing';
import { LayoutDrawerService } from './layout-drawer.service';
import { Component } from '@angular/core';

@Component({ template: '' })
class DummyComponent {}

describe('LayoutDrawerService', () => {
  let service: LayoutDrawerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LayoutDrawerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default state', () => {
    expect(service.isOpen()).toBe(false);
    expect(service.component()).toBeNull();
    expect(service.title()).toBe('');
    expect(service.icon()).toBeUndefined();
  });

  it('should update state on open()', () => {
    service.open(DummyComponent, 'Test Title', 'test-icon');
    expect(service.isOpen()).toBe(true);
    expect(service.component()).toBe(DummyComponent);
    expect(service.title()).toBe('Test Title');
    expect(service.icon()).toBe('test-icon');
  });

  it('should update state on close(), keeping the component for animation', () => {
    service.open(DummyComponent, 'Test Title');
    service.close();
    expect(service.isOpen()).toBe(false);
    expect(service.component()).toBe(DummyComponent); // Ensure not cleared yet
  });

  it('should clean the state on clear()', () => {
    service.open(DummyComponent, 'Test Title');
    service.clear();
    expect(service.component()).toBeNull();
    expect(service.title()).toBe('');
    expect(service.icon()).toBeUndefined();
  });

  it('should update the badge on setBadge()', () => {
    service.open(DummyComponent, 'Test Title');
    service.setBadge('Paso 2 de 6');
    expect(service.badge()).toBe('Paso 2 de 6');
  });

  it('should clear the badge when setBadge(null) is called', () => {
    service.open(DummyComponent, 'Test Title');
    service.setBadge('Paso 2 de 6');
    service.setBadge(null);
    expect(service.badge()).toBeNull();
  });

  it('should default badge() to null when unset', () => {
    expect(service.badge()).toBeNull();
  });
});
