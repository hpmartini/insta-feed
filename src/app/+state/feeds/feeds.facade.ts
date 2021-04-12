import { Injectable } from '@angular/core';
import * as fromFeeds from './feeds.reducer';
import * as fromFeedsSelectors from './feeds.selectors';
import * as fromFeedsActions from './feeds.actions';
import { select, Store } from '@ngrx/store';
import { Feed } from '../../model/feed';

@Injectable()
export class FeedsFacade {
  feeds$ = this.store.pipe(select(fromFeedsSelectors.getAllFeeds));
  isLoaded$ = this.store.pipe(select(fromFeedsSelectors.getFeedsIsLoaded));
  error$ = this.store.pipe(select(fromFeedsSelectors.getFeedsError));

  constructor(private readonly store: Store<fromFeeds.FeedsPartialState>) {}

  loadFeeds(): void {
    this.store.dispatch(fromFeedsActions.loadFeeds());
  }

  addFeed(feed: Feed): void {
    this.store.dispatch(fromFeedsActions.addFeed({ feed }));
  }
}
