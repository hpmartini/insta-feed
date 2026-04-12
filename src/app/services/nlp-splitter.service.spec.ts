import { TestBed } from '@angular/core/testing';

import { NlpSplitterService } from './nlp-splitter.service';

describe('NlpSplitterService', () => {
  let service: NlpSplitterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NlpSplitterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should split simple sentences into chunks', () => {
    const text = 'The big dog is barking.';
    const chunks = service.splitIntoChunks(text);
    expect(chunks).toEqual(['The big dog', 'is barking.']);
  });

  it('should split punctuation properly', () => {
    const text = 'In the park, a small cat runs.';
    const chunks = service.splitIntoChunks(text);
    expect(chunks).toEqual(['In the park,', 'a small cat', 'runs.']);
  });
});
