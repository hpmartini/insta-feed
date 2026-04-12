import { Injectable, inject } from '@angular/core';
import { FeedObject } from '../model/FeedObject';
import { Article } from '../model/article';
import { BehaviorSubject, from } from 'rxjs';
import { Functions, httpsCallable } from '@angular/fire/functions';

declare const require: any;
const Readability = require('@mozilla/readability');
const LanguageDetect = require('languagedetect');

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
    
    let language: 'de' | 'en' = 'de';
    try {
      const lngDetector = new LanguageDetect();
      // detect returns an array of arrays: [ [ 'english', 0.5 ], [ 'german', 0.4 ] ]
      const detected = lngDetector.detect(article.textContent || '', 1);
      if (detected && detected.length > 0 && detected[0][0] === 'english') {
        language = 'en';
      }
    } catch (e) {
      console.error('Language detection failed', e);
    }

    return {
      siteName: article.siteName,
      title: article.title,
      excerpt: article.excerpt,
      content: article.textContent
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/([":])(["])/g, '$1 $2'),
      url: article.link,
      language
    };
  }
}
