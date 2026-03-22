import { TestBed } from '@angular/core/testing';
import { InstructorAlumnosFacade } from './instructor-alumnos.facade';

describe('InstructorAlumnosFacade', () => {
  let facade: InstructorAlumnosFacade;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InstructorAlumnosFacade]
    });
    facade = TestBed.inject(InstructorAlumnosFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });
});
