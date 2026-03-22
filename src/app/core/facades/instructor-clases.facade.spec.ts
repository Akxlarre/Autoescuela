import { TestBed } from '@angular/core/testing';
import { InstructorClasesFacade } from './instructor-clases.facade';

describe('InstructorClasesFacade', () => {
  let facade: InstructorClasesFacade;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InstructorClasesFacade]
    });
    facade = TestBed.inject(InstructorClasesFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });
});
