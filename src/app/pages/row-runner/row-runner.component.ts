import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { Article } from '../../model/article';
import { FeedService } from '../../services/feed.service';
import { ActivatedRoute } from '@angular/router';
import { AnimationActiveService } from '../../services/animation-active.service';

@Component({
  selector: 'app-row-runner',
  templateUrl: './row-runner.component.html',
  styleUrls: ['./row-runner.component.sass'],
})
export class RowRunnerComponent implements OnInit {
  public article: Article;
  public speed = 30;
  public lines: string[];
  public isRowRunnerActive = false;
  public fullScreen = false;
  private start: string;

  constructor(
    private readonly functions: AngularFireFunctions,
    private readonly feedService: FeedService,
    private readonly route: ActivatedRoute,
    private readonly animationActiveService: AnimationActiveService
  ) {}

  ngOnInit(): void {
    this.feedService.article.subscribe((article) => {
      this.article = article ?? null;
      if (this.article && this.start) {
        this.toggleActiveFullscreen();
      }
    });

    this.route.paramMap.subscribe((route) => {
      this.start = route.get('start');
      const url = 'https://'.concat(route.get('url'));
      this.feedService.getArticleByUrl(url.replace(/\\/g, '/'));
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
}
