import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { Article } from '../model/article';
import { FeedService } from '../services/feed.service';
import { TextService } from '../services/text.service';

@Component({
  selector: 'app-row-runner',
  templateUrl: './row-runner.component.html',
  styleUrls: ['./row-runner.component.sass'],
})
export class RowRunnerComponent implements AfterViewInit {
  @ViewChild('dummyDiv', { static: false }) dummyDiv: ElementRef;

  private url = 'https://rss.sueddeutsche.de/rss/Topthemen';

  public article: Article;
  public speed = 30;
  public lines: string[];
  public isRowRunnerActive = false;
  public fullScreen = false;

  constructor(
    private readonly functions: AngularFireFunctions,
    private readonly feedService: FeedService,
    private readonly textService: TextService
  ) {}

  ngAfterViewInit(): void {
    this.feedService.article.subscribe((article) => {
      if (!article) {
        return;
      }

      this.article = article;
      this.lines = this.textService.splitIntoLines(
        this.dummyDiv.nativeElement,
        article.content
      );
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
