import { Component, OnInit } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';

const Readability = require('@mozilla/readability');

@Component({
  selector: 'app-row-runner',
  templateUrl: './row-runner.component.html',
  styleUrls: ['./row-runner.component.sass'],
})
export class RowRunnerComponent implements OnInit {
  private url = 'https://rss.sueddeutsche.de/rss/Topthemen';
  private speed = 20;

  public isRowRunnerActive = false;
  public article;
  public textBuffer: string;

  constructor(private readonly functions: AngularFireFunctions) {}

  ngOnInit(): void {
    console.log('getting feed');
    const getFeed = this.functions.httpsCallable('getFeed');
    getFeed({ url: this.url }).subscribe((result) => {
      this.getArticle(result);
    });
  }

  private getArticle(result) {
    const getArticle = this.functions.httpsCallable('getArticle');
    getArticle({ url: result.items[0].link }).subscribe((result) => {
      this.article = this.getParsedArticleWebSite(result);
      this.textBuffer = this.article.content;
    });
  }

  private getParsedArticleWebSite(result): {} {
    const doc = new DOMParser().parseFromString(result, 'text/html');
    const article = new Readability.Readability(doc).parse();
    return {
      siteName: article.siteName,
      title: article.title,
      excerpt: article.excerpt,
      content: article.textContent,
    };
  }

  private rowRunner = (i: number) => {
    if (i === this.article.content?.length || !this.isRowRunnerActive) return;

    if (i > 0) {
      this.textBuffer = this.textBuffer.slice(0, -3);
    }

    this.textBuffer += this.article.content.charAt(i++);
    this.textBuffer += ' ⌷>';
    setTimeout(this.rowRunner, this.speed, i);
  };

  toggleSrt($event: MouseEvent) {
    if (this.isRowRunnerActive) {
      this.textBuffer = this.article.content;
      this.isRowRunnerActive = false;
      return;
    }

    let i = 0;
    this.textBuffer = '';
    this.isRowRunnerActive = true;

    setTimeout(this.rowRunner, 50, i);
  }
}
