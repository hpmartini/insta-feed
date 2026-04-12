import { NgClass } from "@angular/common";
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Article } from '../../model/article';
import { ActivatedRoute } from '@angular/router';
import { AnimationActiveService } from '../../services/animation-active.service';
import { SettingsFacade } from '../../+state/settings/settings.facade';
import { ArticleService } from '../../services/article.service';
import { SpinnerComponent } from '../../components/spinner/spinner.component';
import { NgIf } from '@angular/common';
import { MatFabButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { AnimationComponent } from './animation/animation.component';

@Component({
    selector: 'app-row-runner',
    templateUrl: './row-runner.component.html',
    styleUrls: ['./row-runner.component.sass'],
    standalone: true,
    
    imports: [NgClass, 
        SpinnerComponent,
        NgIf,
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
  public fullScreen = false;
  public isAutostart = false;

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

  ngOnDestroy(): void {
    this.animationActiveService.isAnimationActive = false;
  }
}
