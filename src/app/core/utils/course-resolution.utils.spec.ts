import { describe, it, expect } from 'vitest';
import { findCourseByLicenseClass } from './course-resolution.utils';
import type { Course } from '@core/models/dto/course.model';

function makeCourse(overrides: Partial<Course>): Course {
  return {
    id: 1,
    name: 'Curso',
    active: true,
    ...overrides,
  };
}

describe('findCourseByLicenseClass', () => {
  const classBBranch1 = makeCourse({
    id: 1,
    code: 'class_b',
    license_class: 'B',
    branch_id: 1,
    base_price: 350000,
  });
  const classBBranch2 = makeCourse({
    id: 2,
    code: 'cc_class_b',
    license_class: 'B',
    branch_id: 2,
    base_price: 180000,
  });
  const professionalA2 = makeCourse({
    id: 3,
    code: 'professional_a2',
    license_class: 'A2',
    branch_id: 2,
    base_price: 800000,
  });
  const classBSenceBranch1 = makeCourse({
    id: 4,
    code: 'class_b_sence',
    license_class: 'B',
    branch_id: 1,
    base_price: 350000,
  });
  const refuerzoBranch1 = makeCourse({
    id: 5,
    code: 'refuerzo_b_1',
    license_class: 'B',
    branch_id: 1,
    base_price: 175000,
    is_reinforcement: true,
  });

  const courses = [
    classBBranch1,
    classBBranch2,
    professionalA2,
    classBSenceBranch1,
    refuerzoBranch1,
  ];

  it('con branchId explícito, devuelve el curso de esa sede aunque haya otra con la misma license_class', () => {
    expect(findCourseByLicenseClass(courses, 'B', { branchId: 2 })?.id).toBe(classBBranch2.id);
    expect(findCourseByLicenseClass(courses, 'B', { branchId: 1 })?.id).toBe(classBBranch1.id);
  });

  it('sin branchId, devuelve el primer match (compat con comportamiento previo)', () => {
    expect(findCourseByLicenseClass(courses, 'B')?.id).toBe(classBBranch1.id);
  });

  it('license_class sin ambigüedad de sede se resuelve igual con o sin branchId', () => {
    expect(findCourseByLicenseClass(courses, 'A2', { branchId: 2 })?.id).toBe(professionalA2.id);
    expect(findCourseByLicenseClass(courses, 'A2')?.id).toBe(professionalA2.id);
  });

  it('con isSence: true, filtra solo cursos cuyo code incluya "sence"', () => {
    expect(findCourseByLicenseClass(courses, 'B', { branchId: 1, isSence: true })?.id).toBe(
      classBSenceBranch1.id,
    );
  });

  it('con isSence: false (default), excluye los cursos SENCE', () => {
    expect(findCourseByLicenseClass(courses, 'B', { branchId: 1, isSence: false })?.id).toBe(
      classBBranch1.id,
    );
  });

  it('devuelve undefined si no hay match', () => {
    expect(findCourseByLicenseClass(courses, 'A5', { branchId: 1 })).toBeUndefined();
  });

  it('con isReinforcement: true, resuelve el curso de Refuerzo sin cruzarse con el estándar ni con SENCE', () => {
    expect(findCourseByLicenseClass(courses, 'B', { branchId: 1, isReinforcement: true })?.id).toBe(
      refuerzoBranch1.id,
    );
  });

  it('con isReinforcement: false (default), excluye el curso de Refuerzo — regresión Clase B estándar', () => {
    expect(findCourseByLicenseClass(courses, 'B', { branchId: 1 })?.id).toBe(classBBranch1.id);
    expect(
      findCourseByLicenseClass(courses, 'B', { branchId: 1, isReinforcement: false })?.id,
    ).toBe(classBBranch1.id);
  });

  it('isSence e isReinforcement no se cruzan entre sí en la misma sede', () => {
    expect(findCourseByLicenseClass(courses, 'B', { branchId: 1, isSence: true })?.id).toBe(
      classBSenceBranch1.id,
    );
    expect(findCourseByLicenseClass(courses, 'B', { branchId: 1, isReinforcement: true })?.id).toBe(
      refuerzoBranch1.id,
    );
  });
});
