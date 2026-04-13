import { ComponentFixture, TestBed, fakeAsync, tick, flush, discardPeriodicTasks } from '@angular/core/testing';
import { AnimationComponent } from './animation.component';
import { ChunkingService } from '../../../services/chunking.service';
import { NlpSplitterService } from '../../../services/nlp-splitter.service';

describe('AnimationComponent', () => {
  let component: AnimationComponent;
  let fixture: ComponentFixture<AnimationComponent>;
  let mockChunkingService: Partial<ChunkingService>;
  let mockNlpSplitterService: Partial<NlpSplitterService>;

  beforeEach(async () => {
    mockChunkingService = {
      hyphenateWord: (word) => [word]
    };
    mockNlpSplitterService = {
      splitIntoChunks: (text) => text.split(' ')
    };

    await TestBed.configureTestingModule({
      imports: [AnimationComponent],
      providers: [
        { provide: ChunkingService, useValue: mockChunkingService },
        { provide: NlpSplitterService, useValue: mockNlpSplitterService }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AnimationComponent);
    component = fixture.componentInstance;
    component.inputText = 'Hello world';
    component.speed = 10;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should process entire words when isSemanticRsvp is true', fakeAsync(() => {
    component.isSemanticRsvp = true;
    component.ngAfterViewInit(); // Start animation
    
    // First word should be processed immediately
    expect(component.output).toBe('Hello');
    
    tick(50); // Hello is 5 chars, speed is 10, multiplier 1.0 -> 50ms delay
    expect(component.output).toBe('world');
    
    flush();
    discardPeriodicTasks();
  }));
});
