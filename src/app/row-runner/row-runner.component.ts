import { AfterViewInit, Component } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { Article } from '../model/article';
import { FeedService } from '../services/feed.service';

@Component({
  selector: 'app-row-runner',
  templateUrl: './row-runner.component.html',
  styleUrls: ['./row-runner.component.sass'],
})
export class RowRunnerComponent implements AfterViewInit {
  private url = 'https://rss.sueddeutsche.de/rss/Topthemen';

  public article: Article;
  public speed = 30;
  public lines: string[];
  public isRowRunnerActive = false;
  public fullScreen = false;

  constructor(
    private readonly functions: AngularFireFunctions,
    private readonly feedService: FeedService
  ) {}

  ngAfterViewInit(): void {
    this.feedService.article.subscribe((article) => {
      if (!article) {
        return;
      }

      this.article = article;
    });

    this.feedService.getArticleByUrl(this.url);
  }

  toggleActive(): void {
    this.isRowRunnerActive = !this.isRowRunnerActive;
    this.fullScreen = false;
  }

  toggleActiveFullscreen(): void {
    this.isRowRunnerActive = !this.isRowRunnerActive;
    this.fullScreen = !this.fullScreen;
  }
}
