import { TestBed } from '@angular/core/testing';

import { AnimationActiveService } from './animation-active.service';

describe('AnimationActiveService', () => {
  let service: AnimationActiveService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AnimationActiveService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
