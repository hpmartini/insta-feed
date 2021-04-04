import { Component, OnDestroy, OnInit } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { Article } from '../../model/article';
import { FeedService } from '../../services/feed.service';
import { ActivatedRoute } from '@angular/router';
import { AnimationActiveService } from '../../services/animation-active.service';
import { SettingsFacade } from '../../+state/settings/settings.facade';

@Component({
  selector: 'app-row-runner',
  templateUrl: './row-runner.component.html',
  styleUrls: ['./row-runner.component.sass'],
})
export class RowRunnerComponent implements OnInit, OnDestroy {
  public article: Article;
  public speed = 30;
  public lines: string[];
  public isRowRunnerActive = false;
  public fullScreen = false;
  public isAutostart = false;

  constructor(
    private readonly functions: AngularFireFunctions,
    private readonly feedService: FeedService,
    private readonly route: ActivatedRoute,
    private readonly animationActiveService: AnimationActiveService,
    private readonly settingsFacade: SettingsFacade
  ) {}

  ngOnInit(): void {
    this.settingsFacade.settings$.subscribe(
      (settings) => (this.speed = settings?.speed ?? this.speed)
    );

    this.feedService.article.subscribe((article) => {
      this.article = article ?? null;
      if (this.article && this.isAutostart) {
        this.isAutostart = false;
        this.toggleActiveFullscreen();
      }
    });

    this.route.paramMap.subscribe((route) => {
      this.isAutostart = route.get('isAutostart') === 'true';
      const feedUrl = 'https://'.concat(route.get('url'));
      this.feedService.loadArticle(feedUrl.replace(/\\/g, '/'));
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
