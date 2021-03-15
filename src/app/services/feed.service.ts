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

  private emptyArticle: {
    siteName: '';
    content: '';
    excerpt: '';
    title: '';
    url: '';
  };

  public article = new BehaviorSubject<Article>(null);
  public articleList = new BehaviorSubject<FeedObject[]>(null);
  public updatingFeedList = new BehaviorSubject<boolean>(false);
  public feedList = new BehaviorSubject<[]>(null);
  public lines: string[];

  constructor(private readonly functions: AngularFireFunctions) {}

  public addFeedToFirestore(feed: Feed): void {
    this.updatingFeedList.next(true);
    const addFeed = this.functions.httpsCallable('addFeed');
    addFeed(feed).subscribe((result) => {
      if (result) {
        this.getFeedListFromFirestore();
      }
      this.updatingFeedList.next(false);
    });
  }

  public getFeedListFromFirestore(): void {
    const getFeedList = this.functions.httpsCallable('getFeedList');
    getFeedList(null).subscribe((feedList) => this.feedList.next(feedList));
  }

  public loadArticleList(url: string): void {
    this.articleList.next([]);
    const getFeed = this.functions.httpsCallable('getFeed');
    getFeed({ url }).subscribe((result) => {
      this.articleList.next(
        result.items.map((item: FeedObject) => ({
          ...item,
          guid: item.guid.replace('https://', ''),
          link: item.link.replace('https://', ''),
        }))
      );
    });
  }

  public getArticleByUrl(url: string, index: number): void {
    console.log(url);
    this.article.next(this.emptyArticle);
    const getFeed = this.functions.httpsCallable('getFeed');
    getFeed({ url }).subscribe((result) =>
      this.loadArticle(result.items[index].link)
    );
  }

  public loadArticle(url): void {
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
      content: article.textContent
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/([":])(["])/g, '$1 $2'),
      url: article.link,
    };
  }

  deleteFeed(feedName: string): void {
    this.updatingFeedList.next(true);
    const deleteFeed = this.functions.httpsCallable('deleteFeed');
    deleteFeed({ name: feedName }).subscribe(() =>
      this.updatingFeedList.next(false)
    );
  }
}
