import { ElementRef, Injectable, ViewChild } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { BehaviorSubject } from 'rxjs';
import { Feed } from '../model/feed';

@Injectable()
export class FeedService {
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

  deleteFeed(feedName: string): void {
    this.updatingFeedList.next(true);
    this.CALLABLE('deleteFeed')({ name: feedName }).subscribe(() =>
      this.updatingFeedList.next(false)
    );
  }
}
