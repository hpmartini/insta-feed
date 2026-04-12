import { TestBed } from '@angular/core/testing';
import { ChunkingService } from './chunking.service';

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChunkingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should hyphenate German text with soft hyphens', () => {
    const result = service.hyphenateText('Wassermelone', 'de');
    // Using hex \u00AD for soft hyphen representation
    expect(result).toBe('Was\u00ADser\u00ADme\u00ADlo\u00ADne');
  });

  it('should hyphenate English text with soft hyphens', () => {
    const result = service.hyphenateText('watermelon', 'en');
    expect(result).toBe('wa\u00ADter\u00ADmelon');
  });

  it('should default to German hyphenation if no language is specified', () => {
    const result = service.hyphenateText('Wassermelone');
    expect(result).toBe('Was\u00ADser\u00ADme\u00ADlo\u00ADne');
  });

  it('should return empty string if input is empty text', () => {
    expect(service.hyphenateText('')).toBe('');
    expect(service.hyphenateText(null as any)).toBe('');
  });

  it('should return syllables for a given word in German', () => {
    const result = service.hyphenateWord('Wassermelone', 'de');
    expect(result).toEqual(['Was', 'ser', 'me', 'lo', 'ne']);
  });

  it('should return syllables for a given word in English', () => {
    const result = service.hyphenateWord('watermelon', 'en');
    expect(result).toEqual(['wa', 'ter', 'melon']);
  });
});
