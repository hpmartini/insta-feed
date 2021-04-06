import { ElementRef, Injectable, ViewChild } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { BehaviorSubject, Observable } from 'rxjs';
import { Feed } from '../../model/feed';

@Injectable()
export class FeedsService {
  @ViewChild('dummyDiv', { static: false }) dummyDiv: ElementRef;
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
        this.loadFeeds();
      }
      this.updatingFeedList.next(false);
    });
  }

  public loadFeeds(): Observable<any> {
    return this.CALLABLE('getFeedList')(null);
  }

  deleteFeed(feedName: string): void {
    this.updatingFeedList.next(true);
    this.CALLABLE('deleteFeed')({ name: feedName }).subscribe(() =>
      this.updatingFeedList.next(false)
    );
  }
}
