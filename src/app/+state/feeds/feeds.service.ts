import { ElementRef, Injectable, ViewChild } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { BehaviorSubject, Observable } from 'rxjs';
import { Feed } from '../../model/feed';

@Injectable()
export class FeedsService {
  @ViewChild('dummyDiv', { static: false }) dummyDiv: ElementRef;
  public feedList = new BehaviorSubject<[]>(null);
  public savingSettings = new BehaviorSubject<boolean>(false);
  public lines: string[];

  constructor(private readonly functions: AngularFireFunctions) {}

  private readonly CALLABLE = this.functions.httpsCallable;

  public addFeedToFirestore(feed: Feed): Observable<any> {
    return this.CALLABLE('addFeed')(feed);
  }

  public loadFeeds(): Observable<any> {
    return this.CALLABLE('getFeedList')(null);
  }

  public deleteFeed(feedName: string): Observable<any> {
    return this.CALLABLE('deleteFeed')({ name: feedName });
  }
}
