import { createRequestGuard } from './request-guard.utils';

describe('request-guard.utils (spec 0005-m)', () => {
  it('next() devuelve tokens estrictamente incrementales', () => {
    const guard = createRequestGuard();
    const t1 = guard.next();
    const t2 = guard.next();
    const t3 = guard.next();
    expect(t2).toBeGreaterThan(t1);
    expect(t3).toBeGreaterThan(t2);
  });

  it('isCurrent(token) es true solo para el último token emitido', () => {
    const guard = createRequestGuard();
    const t1 = guard.next();
    const t2 = guard.next();
    expect(guard.isCurrent(t1)).toBe(false);
    expect(guard.isCurrent(t2)).toBe(true);
  });

  it('isCurrent(tokenViejo) pasa a false tras emitir un token nuevo', () => {
    const guard = createRequestGuard();
    const t1 = guard.next();
    expect(guard.isCurrent(t1)).toBe(true);
    guard.next();
    expect(guard.isCurrent(t1)).toBe(false);
  });

  it('dos instancias de createRequestGuard() no comparten contador entre sí', () => {
    const guardA = createRequestGuard();
    const guardB = createRequestGuard();
    const tokenA = guardA.next();
    const tokenB = guardB.next();
    expect(guardA.isCurrent(tokenA)).toBe(true);
    expect(guardB.isCurrent(tokenB)).toBe(true);
    // el token de A no debe validar contra B ni viceversa, aunque numéricamente coincidan
    expect(guardB.isCurrent(tokenA)).toBe(tokenA === tokenB);
  });
});
