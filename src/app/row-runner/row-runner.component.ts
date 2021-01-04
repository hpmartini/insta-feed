import { Component, OnInit } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';

const Readability = require('@mozilla/readability');

@Component({
  selector: 'app-row-runner',
  templateUrl: './row-runner.component.html',
  styleUrls: ['./row-runner.component.sass'],
})
export class RowRunnerComponent implements OnInit {
  constructor(private readonly functions: AngularFireFunctions) {}

  private url = 'https://rss.sueddeutsche.de/rss/Topthemen';
  public data;

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
      this.getParsedArticleWebSite(result);
    });
  }

  private getParsedArticleWebSite(result): {} {
    const doc = new DOMParser().parseFromString(result, 'text/html');
    const reader = new Readability.Readability(doc);
    const article = reader.parse();
    console.log(article);
    return article;
  }
}
