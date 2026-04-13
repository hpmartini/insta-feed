import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { RowRunnerComponent } from './row-runner.component';
import { AnimationActiveService } from '../../services/animation-active.service';

describe('RowRunnerComponent', () => {
  let component: RowRunnerComponent;
  let fixture: ComponentFixture<RowRunnerComponent>;
  let mockAnimationActiveService: Partial<AnimationActiveService>;

  beforeEach(waitForAsync(() => {
    mockAnimationActiveService = {
      isAnimationActive: false
    };

    TestBed.configureTestingModule({
      imports: [RowRunnerComponent],
      providers: [
        { provide: AnimationActiveService, useValue: mockAnimationActiveService }
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RowRunnerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle RSVP mode', () => {
    expect(component.isSemanticRsvp).toBeFalse();
    component.toggleRsvpMode();
    expect(component.isSemanticRsvp).toBeTrue();
    component.toggleRsvpMode();
    expect(component.isSemanticRsvp).toBeFalse();
  });
});