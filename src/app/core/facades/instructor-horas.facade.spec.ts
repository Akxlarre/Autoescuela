import { TestBed } from '@angular/core/testing';
import { InstructorHorasFacade } from './instructor-horas.facade';

describe('InstructorHorasFacade', () => {
  let facade: InstructorHorasFacade;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InstructorHorasFacade]
    });
    facade = TestBed.inject(InstructorHorasFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });
});
