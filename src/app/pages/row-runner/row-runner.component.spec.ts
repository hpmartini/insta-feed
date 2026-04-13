import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { RowRunnerComponent } from './row-runner.component';
import { AnimationActiveService } from '../../services/animation-active.service';
import { Functions } from '@angular/fire/functions';
import { SettingsFacade } from '../../+state/settings/settings.facade';
import { ArticleService } from '../../services/article.service';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('RowRunnerComponent', () => {
  let component: RowRunnerComponent;
  let fixture: ComponentFixture<RowRunnerComponent>;
  let mockAnimationActiveService: Partial<AnimationActiveService>;
  let mockFunctions: Partial<Functions>;

  beforeEach(waitForAsync(() => {
    mockAnimationActiveService = {
      isAnimationActive: false
    };
    mockFunctions = {};

    TestBed.configureTestingModule({
      imports: [RowRunnerComponent],
      providers: [
        { provide: AnimationActiveService, useValue: mockAnimationActiveService },
        { provide: Functions, useValue: mockFunctions },
        { provide: SettingsFacade, useValue: { isSemanticRsvp$: of(false), settings$: of({ speed: 300 }) } },
        { provide: ArticleService, useValue: { currentArticle$: of(null), article: of(null) } },
        { provide: ActivatedRoute, useValue: { paramMap: of({ get: () => null }), snapshot: { queryParams: {} } } }
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