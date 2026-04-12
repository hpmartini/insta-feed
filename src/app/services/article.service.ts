import { Injectable, inject } from '@angular/core';
import { FeedObject } from '../model/FeedObject';
import { Article } from '../model/article';
import { BehaviorSubject, from } from 'rxjs';
import { Functions, httpsCallable } from '@angular/fire/functions';

declare const require: any;
const Readability = require('@mozilla/readability');

@Injectable({
  providedIn: 'root'
})
export class ArticleService {
  public article = new BehaviorSubject<Article | null>(null);
  public articleList = new BehaviorSubject<FeedObject[] | null>(null);
  
  private readonly functions: Functions = inject(Functions);

  constructor() {}

  public loadArticleList(url: string): void {
    this.articleList.next([]);
    const getFeed = httpsCallable(this.functions, 'getFeed');
    from(getFeed({ url })).subscribe((result: any) => {
      this.articleList.next(
        result.data.items.map((item: FeedObject) => ({
          ...item,
          guid: item.guid ? item.guid.replace('https://', '') : '',
          link: item.link ? item.link.replace('https://', '') : '',
        }))
      );
    });
  }

  public loadArticle(url: string): void {
    const getArticle = httpsCallable(this.functions, 'getArticle');
    from(getArticle({ url })).subscribe((result: any) =>
      this.article.next(this.getParsedArticleWebSite(result.data))
    );
  }

  private getParsedArticleWebSite(result: string): Article {
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
      url: article.link, // Note: readability might not return 'link'. This was in original code.
    };
  }
}
