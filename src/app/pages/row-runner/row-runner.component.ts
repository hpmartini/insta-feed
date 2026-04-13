import { NgClass, NgFor, NgIf } from "@angular/common";
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Article } from '../../model/article';
import { ActivatedRoute } from '@angular/router';
import { AnimationActiveService } from '../../services/animation-active.service';
import { SettingsFacade } from '../../+state/settings/settings.facade';
import { ArticleService } from '../../services/article.service';
import { SpinnerComponent } from '../../components/spinner/spinner.component';
import { MatFabButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { AnimationComponent } from './animation/animation.component';
import { SupportedLanguage } from '../../services/chunking.service';

@Component({
    selector: 'app-row-runner',
    templateUrl: './row-runner.component.html',
    styleUrls: ['./row-runner.component.sass'],
    standalone: true,
    
    imports: [NgClass, 
        SpinnerComponent,
        NgIf,
        NgFor,
        MatFabButton,
        MatIcon,
        AnimationComponent,
    ],
})
export class RowRunnerComponent implements OnInit, OnDestroy {
  public article!: Article | null;
  public speed = 30;
  public lines!: string[];
  public isRowRunnerActive = false;
  public isSemanticRsvp = false;
  public fullScreen = false;
  public isAutostart = false;
  public languageOverride: SupportedLanguage | null = null;

  public showQuiz = false;
  public quizData: any = null;
  public quizLoading = false;
  public quizAnswers: { [key: number]: number } = {};
  public quizResults: { [key: number]: boolean } = {};

  private readonly functions: Functions = inject(Functions);

  get activeLanguage(): SupportedLanguage {
    return this.languageOverride || this.article?.language || 'de';
  }

  get activeLanguageDisplay(): string {
    return this.activeLanguage.toUpperCase();
  }

  constructor(
    private readonly articleService: ArticleService,
    private readonly route: ActivatedRoute,
    private readonly animationActiveService: AnimationActiveService,
    private readonly settingsFacade: SettingsFacade
  ) {}

  ngOnInit(): void {
    this.settingsFacade.settings$.subscribe(
      (settings) => (this.speed = settings?.speed ?? this.speed)
    );

    this.articleService.article.subscribe((article) => {
      this.article = article ?? null;
      if (this.article && this.isAutostart) {
        this.isAutostart = false;
        this.toggleActiveFullscreen();
      }
    });

    this.route.paramMap.subscribe((route) => {
      this.isAutostart = route.get('isAutostart') === 'true';
      const feedUrl = 'https://'.concat(route.get('url') || '');
      this.articleService.loadArticle(feedUrl.replace(/\\/g, '/'));
    });
  }

  toggleActive(): void {
    this.isRowRunnerActive = !this.isRowRunnerActive;
    this.fullScreen = false;
    this.animationActiveService.isAnimationActive = false;
  }

  toggleActiveFullscreen(): void {
    this.isRowRunnerActive = !this.isRowRunnerActive;
    this.fullScreen = !this.fullScreen;
    this.animationActiveService.isAnimationActive = this.isRowRunnerActive;
  }

  toggleLanguage(): void {
    this.languageOverride = this.activeLanguage === 'de' ? 'en' : 'de';
  }

  toggleRsvpMode(): void {
    this.isSemanticRsvp = !this.isSemanticRsvp;
  }

  ngOnDestroy(): void {
    this.animationActiveService.isAnimationActive = false;
  }

  onAnimationFinished(): void {
    if (!this.article?.content || this.showQuiz) return;
    this.showQuiz = true;
    this.quizLoading = true;
    
    const generateMicroQuiz = httpsCallable(this.functions, 'generateMicroQuiz');
    generateMicroQuiz({ text: this.article.content })
      .then((result: any) => {
        this.quizData = result.data;
        this.quizLoading = false;
      })
      .catch((error) => {
        console.error('Error generating quiz', error);
        this.quizLoading = false;
      });
  }

  selectAnswer(qIndex: number, optIndex: number): void {
    this.quizAnswers[qIndex] = optIndex;
    const correctIndex = this.quizData?.questions?.[qIndex]?.correctIndex;
    this.quizResults[qIndex] = (optIndex === correctIndex);
  }
}
