import { Injectable } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { Article } from '../model/article';
import { BehaviorSubject } from 'rxjs';

const Readability = require('@mozilla/readability');

@Injectable()
export class FeedService {
  private emptyArticle: { siteName: ''; content: ''; excerpt: ''; title: '' };
  public article = new BehaviorSubject<Article>(null);

  constructor(private readonly functions: AngularFireFunctions) {}

  public getArticleByUrl(url: string): void {
    this.article.next(this.emptyArticle);
    const getFeed = this.functions.httpsCallable('getFeed');
    getFeed({ url }).subscribe((result) =>
      this.loadArticle(result.items[0].link)
    );
  }

  private loadArticle(url): void {
    const getArticle = this.functions.httpsCallable('getArticle');
    getArticle({ url }).subscribe((article) =>
      this.article.next(this.getParsedArticleWebSite(article))
    );
  }

  private getParsedArticleWebSite(result): Article {
    const doc = new DOMParser().parseFromString(result, 'text/html');
    const article = new Readability.Readability(doc).parse();
    return {
      siteName: article.siteName,
      title: article.title,
      excerpt: article.excerpt,
      content: article.textContent,
    };
  }
}
