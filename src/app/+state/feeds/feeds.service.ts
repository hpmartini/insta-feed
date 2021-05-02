import { ElementRef, Injectable, ViewChild } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { BehaviorSubject, Observable } from 'rxjs';
import { Feed } from '../../model/feed';
import { AngularFirestore } from '@angular/fire/firestore';
import { FIREBASE_CONSTANTS } from '../../constants/firebase.constants';

@Injectable()
export class FeedsService {
  @ViewChild('dummyDiv', { static: false }) dummyDiv: ElementRef;
  public feedList = new BehaviorSubject<[]>(null);
  public savingSettings = new BehaviorSubject<boolean>(false);
  public lines: string[];

  constructor(
    private readonly functions: AngularFireFunctions,
    private readonly firestore: AngularFirestore
  ) {}

  private readonly CALLABLE = this.functions.httpsCallable;

  public subscribe(feed: Feed): Observable<any> {
    this.firestore.collection(FIREBASE_CONSTANTS.feeds).doc();

    return this.CALLABLE('setFeed')(feed);
  }

  public loadFeeds(): Observable<any> {
    return this.CALLABLE('getFeedList')(null);
  }

  public unsubscribe(feedName: string): Observable<any> {
    return this.CALLABLE('unsubscribe')({ name: feedName });
  }
}
