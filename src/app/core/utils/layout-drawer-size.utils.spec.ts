import { describe, expect, it } from 'vitest';
import {
  LAYOUT_DRAWER_MOBILE_BREAKPOINT,
  isLayoutDrawerMobile,
  layoutDrawerDesktopWidth,
} from './layout-drawer-size.utils';

describe('tamaño del panel lateral (fix-317-m)', () => {
  it('bajo 768 px el panel va a pantalla completa', () => {
    expect(LAYOUT_DRAWER_MOBILE_BREAKPOINT).toBe(768);
    expect(isLayoutDrawerMobile(767)).toBe(true);
    expect(isLayoutDrawerMobile(768)).toBe(false);
  });

  it('en escritorio ocupa el 45 % del ancho de la ventana', () => {
    expect(layoutDrawerDesktopWidth(1600)).toBe(720);
    expect(layoutDrawerDesktopWidth(1366)).toBeCloseTo(614.7);
  });

  it('nunca mide menos de 400 px', () => {
    expect(layoutDrawerDesktopWidth(800)).toBe(400);
  });

  it('un ancho fijo pedido por el panel manda sobre el 45 %', () => {
    expect(layoutDrawerDesktopWidth(1600, 520)).toBe(520);
  });
});
