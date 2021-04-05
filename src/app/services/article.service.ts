import { Injectable } from '@angular/core';
import { FeedObject } from '../model/FeedObject';
import { Article } from '../model/article';
import { BehaviorSubject } from 'rxjs';
import { AngularFireFunctions } from '@angular/fire/functions';

const Readability = require('@mozilla/readability');

@Injectable()
export class ArticleService {
  public article = new BehaviorSubject<Article>(null);
  public articleList = new BehaviorSubject<FeedObject[]>(null);

  constructor(private readonly functions: AngularFireFunctions) {}

  private readonly CALLABLE = this.functions.httpsCallable;

  public loadArticleList(url: string): void {
    this.articleList.next([]);
    this.CALLABLE('getFeed')({ url }).subscribe((result) => {
      this.articleList.next(
        result.items.map((item: FeedObject) => ({
          ...item,
          guid: item.guid.replace('https://', ''),
          link: item.link.replace('https://', ''),
        }))
      );
    });
  }

  public loadArticle(url): void {
    this.CALLABLE('getArticle')({ url }).subscribe((article) =>
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
      content: article.textContent
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/([":])(["])/g, '$1 $2'),
      url: article.link,
    };
  }
}
