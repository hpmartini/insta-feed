import { ElementRef, Injectable, ViewChild } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { Article } from '../model/article';
import { BehaviorSubject } from 'rxjs';
import { Feed } from '../model/feed';
import { FeedObject } from '../model/FeedObject';

const Readability = require('@mozilla/readability');

@Injectable()
export class FeedService {
  @ViewChild('dummyDiv', { static: false }) dummyDiv: ElementRef;

  public article = new BehaviorSubject<Article>(null);
  public articleList = new BehaviorSubject<FeedObject[]>(null);
  public updatingFeedList = new BehaviorSubject<boolean>(false);
  public feedList = new BehaviorSubject<[]>(null);
  public savingSettings = new BehaviorSubject<boolean>(false);
  public lines: string[];

  constructor(private readonly functions: AngularFireFunctions) {}

  private readonly CALLABLE = this.functions.httpsCallable;

  public addFeedToFirestore(feed: Feed): void {
    this.updatingFeedList.next(true);
    this.CALLABLE('addFeed')(feed).subscribe((result) => {
      if (result) {
        this.getFeedListFromFirestore();
      }
      this.updatingFeedList.next(false);
    });
  }

  public getFeedListFromFirestore(): void {
    this.CALLABLE('getFeedList')(null).subscribe((feedList) =>
      this.feedList.next(feedList)
    );
  }

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

  deleteFeed(feedName: string): void {
    this.updatingFeedList.next(true);
    this.CALLABLE('deleteFeed')({ name: feedName }).subscribe(() =>
      this.updatingFeedList.next(false)
    );
  }
}
