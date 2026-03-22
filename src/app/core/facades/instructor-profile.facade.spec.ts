import { TestBed } from '@angular/core/testing';
import { InstructorProfileFacade } from './instructor-profile.facade';

describe('InstructorProfileFacade', () => {
  let facade: InstructorProfileFacade;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InstructorProfileFacade]
    });
    facade = TestBed.inject(InstructorProfileFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });
});
