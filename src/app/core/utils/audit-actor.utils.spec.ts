import { describe, expect, it } from 'vitest';

import { auditActorPlan, auditUserLabel, usuariosForActor } from './audit-actor.utils';

describe('auditActorPlan (fix-069-i)', () => {
  it('Secretarias: solo filas de secretarias, sede de la secretaria (como antes)', () => {
    expect(auditActorPlan('secretarias')).toEqual({
      innerUsers: true,
      roleName: 'secretary',
      onlySystem: false,
      branchColumn: 'users.branch_id',
    });
  });

  it('Admin: solo filas de administradores, sede de la acción', () => {
    expect(auditActorPlan('admin')).toEqual({
      innerUsers: true,
      roleName: 'admin',
      onlySystem: false,
      branchColumn: 'branch_id',
    });
  });

  it('Sistema: filas sin usuario (limpieza automática)', () => {
    expect(auditActorPlan('sistema')).toEqual({
      innerUsers: false,
      roleName: null,
      onlySystem: true,
      branchColumn: 'branch_id',
    });
  });

  it('Todos: no excluye filas sin usuario', () => {
    expect(auditActorPlan('todos')).toEqual({
      innerUsers: false,
      roleName: null,
      onlySystem: false,
      branchColumn: 'branch_id',
    });
  });
});

describe('auditUserLabel (fix-069-i)', () => {
  it('sin usuario es Sistema', () => {
    expect(auditUserLabel(null)).toBe('Sistema');
  });

  it('traduce el rol', () => {
    expect(auditUserLabel('secretary')).toBe('Secretaria');
    expect(auditUserLabel('admin')).toBe('Administrador');
    expect(auditUserLabel('instructor')).toBe('Instructor');
  });
});

describe('usuariosForActor (fix-069-i)', () => {
  const usuarios = [
    { id: 1, nombre: 'Ana', email: 'a@x', rol: 'secretary' },
    { id: 2, nombre: 'Beto', email: 'b@x', rol: 'admin' },
  ];

  it('filtra la lista de usuarios por el Quién elegido', () => {
    expect(usuariosForActor(usuarios, 'secretarias').map((u) => u.id)).toEqual([1]);
    expect(usuariosForActor(usuarios, 'admin').map((u) => u.id)).toEqual([2]);
    expect(usuariosForActor(usuarios, 'todos').map((u) => u.id)).toEqual([1, 2]);
    expect(usuariosForActor(usuarios, 'sistema')).toEqual([]);
  });
});
