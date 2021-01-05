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
  public article;

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
      let i = 0;
      const speed = 30;
      const text = this.article.content;
      this.article.content = '';
      const rowRunner = () => {
        if (i === text.length) return;
        this.article.content += text.charAt(i++);
        setTimeout(rowRunner, speed);
      };
      setTimeout(rowRunner, 500);
    });
  }

  private getParsedArticleWebSite(result): {} {
    const doc = new DOMParser().parseFromString(result, 'text/html');
    const reader = new Readability.Readability(doc);
    const article = reader.parse();
    return {
      siteName: article.siteName,
      title: article.title,
      excerpt: article.excerpt,
      content: article.textContent,
    };
  }
}
