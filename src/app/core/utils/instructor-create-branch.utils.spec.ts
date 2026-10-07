import { describe, expect, it } from 'vitest';
import { resolveInstructorCreateBranch } from './instructor-create-branch.utils';

// fix-201-b (S3 de ASG-i-034): la sede del alta de instructor salía solo del topbar.
describe('resolveInstructorCreateBranch', () => {
  it('secretaria sin grant → su propia sede, sin campo, aunque el topbar diga otra', () => {
    expect(resolveInstructorCreateBranch('secretaria', 1, false, 2)).toEqual({
      canPick: false,
      branchId: 1,
      missingOwnBranch: false,
    });
    expect(resolveInstructorCreateBranch('secretaria', 1, false, null)).toEqual({
      canPick: false,
      branchId: 1,
      missingOwnBranch: false,
    });
  });

  it('secretaria sin grant y sin sede asignada → avisa (no puede crear)', () => {
    expect(resolveInstructorCreateBranch('secretaria', null, false, 2)).toEqual({
      canPick: false,
      branchId: null,
      missingOwnBranch: true,
    });
  });

  it('admin → elige; parte con la sede del topbar (o sin sede si está en "Todas")', () => {
    expect(resolveInstructorCreateBranch('admin', null, false, 2)).toEqual({
      canPick: true,
      branchId: 2,
      missingOwnBranch: false,
    });
    expect(resolveInstructorCreateBranch('admin', null, false, null)).toEqual({
      canPick: true,
      branchId: null,
      missingOwnBranch: false,
    });
  });

  it('secretaria multi-sede → elige, igual que el admin', () => {
    expect(resolveInstructorCreateBranch('secretaria', 1, true, null)).toEqual({
      canPick: true,
      branchId: null,
      missingOwnBranch: false,
    });
    expect(resolveInstructorCreateBranch('secretaria', 1, true, 2).branchId).toBe(2);
  });
});
