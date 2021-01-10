import {Component, OnInit} from '@angular/core';
import {AngularFireFunctions} from '@angular/fire/functions';
import {Article} from '../model/article';
import {FeedService} from '../services/feed.service';

@Component({
  selector: 'app-row-runner',
  templateUrl: './row-runner.component.html',
  styleUrls: ['./row-runner.component.sass'],
})
export class RowRunnerComponent implements OnInit {
  private url = 'https://rss.sueddeutsche.de/rss/Topthemen';
  private speed = 20;

  public isRowRunnerActive = false;
  public article: Article;
  public textBuffer: string;

  constructor(private readonly functions: AngularFireFunctions, private readonly feedService: FeedService) {
  }

  ngOnInit(): void {
    this.feedService.article.subscribe((article) => {
      this.article = article ?? null;
      this.textBuffer = article?.content;
    });
    this.feedService.getArticleByUrl(this.url);
  }

  toggleSrt(): void {
    if (this.isRowRunnerActive) {
      this.textBuffer = this.article.content;
      this.isRowRunnerActive = false;
      return;
    }

    this.isRowRunnerActive = true;
    this.textBuffer = '';

    this.animate();
  }

  /**
   * for each char in string
   *    if content is longer then div
   *      try to split last word
   *      add line to line array
   */
  private animate(): void {
    [...this.article.content].forEach(async (char, index) => {
      this.textBuffer = this.textBuffer?.slice(0, -2);
      this.textBuffer += char;
      this.textBuffer += ' ▶';
      await this.sleep(index * this.speed);
    });
  }

  sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));
}
