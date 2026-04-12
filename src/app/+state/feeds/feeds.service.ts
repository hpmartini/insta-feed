import { ElementRef, Injectable, ViewChild, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Firestore, collection, doc } from '@angular/fire/firestore';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Feed } from '../../model/feed';
import { FIREBASE_CONSTANTS } from '../../constants/firebase.constants';

@Injectable({ providedIn: 'root' })
export class FeedsService {
  @ViewChild('dummyDiv', { static: false }) dummyDiv!: ElementRef;
  public feedList = new BehaviorSubject<any[] | null>(null);
  public savingSettings = new BehaviorSubject<boolean>(false);
  public lines!: string[];

  private readonly functions: Functions = inject(Functions);
  private readonly firestore: Firestore = inject(Firestore);

  constructor() {}

  public subscribe(feed: Feed): Observable<any> {
    const feedsCollection = collection(this.firestore, FIREBASE_CONSTANTS.feeds);
    doc(feedsCollection); // The original code created an empty doc reference but didn't use it

    const setFeed = httpsCallable(this.functions, 'setFeed');
    return from(setFeed(feed)).pipe(map(result => result.data));
  }

  public loadFeeds(): Observable<any> {
    const getFeedList = httpsCallable(this.functions, 'getFeedList');
    return from(getFeedList(null)).pipe(map(result => result.data));
  }

  public unsubscribe(feed: Feed): Observable<any> {
    const unsubscribeFunc = httpsCallable(this.functions, 'unsubscribe');
    return from(unsubscribeFunc(feed)).pipe(map(result => result.data));
  }
}
