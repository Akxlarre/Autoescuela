import { describe, expect, it } from 'vitest';
import { isReturningFromFicha } from './alumnos-list-navigation.utils';

describe('isReturningFromFicha() — hotfix-126-m', () => {
  it.each([
    '/app/admin/alumnos/2952',
    '/app/secretaria/alumnos/17',
    '/app/admin/alumnos/2952?enrollment=2877',
    '/app/secretaria/alumnos/17?from=ex-alumnos&enrollment=3',
  ])('viene de la ficha de un alumno: %s', (url) => {
    expect(isReturningFromFicha(url)).toBe(true);
  });

  it.each([
    '/app/admin/alumnos',
    '/app/admin/agenda',
    '/app/admin/ex-alumnos',
    '/app/admin/alumnos-profesional/12',
    '/app/admin/dashboard',
    '/login',
    '',
    null,
    undefined,
  ])('no viene de una ficha: %s', (url) => {
    expect(isReturningFromFicha(url)).toBe(false);
  });
});
