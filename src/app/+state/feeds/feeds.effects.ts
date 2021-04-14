import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { FeedsService } from './feeds.service';
import * as FeedActions from './feeds.actions';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable()
export class FeedsEffects {
  constructor(
    private readonly action$: Actions,
    private readonly feedsService: FeedsService
  ) {}

  loadFeeds$ = createEffect(() =>
    this.action$.pipe(
      ofType(FeedActions.loadFeeds),
      mergeMap(() =>
        this.feedsService.loadFeeds().pipe(
          map((feeds) => FeedActions.loadFeedsSuccess({ feeds })),
          catchError((error) => of(FeedActions.loadFeedsFailure({ error })))
        )
      )
    )
  );

  addFeed$ = createEffect(() =>
    this.action$.pipe(
      ofType(FeedActions.addFeed),
      mergeMap((action) =>
        this.feedsService.addFeedToFirestore(action.feed).pipe(
          map((result) =>
            FeedActions.addFeedSuccess({ result, addedFeed: action.feed })
          ),
          catchError((error) => of(FeedActions.loadFeedsFailure({ error })))
        )
      )
    )
  );

  deleteFeed$ = createEffect(() =>
    this.action$.pipe(
      ofType(FeedActions.deleteFeed),
      mergeMap((action) =>
        this.feedsService.deleteFeed(action.feed.name).pipe(
          map(() => FeedActions.deleteFeedSuccess({ feed: action.feed })),
          catchError((error) => of(FeedActions.deleteFeedFailure({ error })))
        )
      )
    )
  );

  updateFeed$ = createEffect(() =>
    this.action$.pipe(
      ofType(FeedActions.updateFeed),
      mergeMap((action) =>
        this.feedsService.addFeedToFirestore(action.feed).pipe(
          map(() => FeedActions.updateFeedSuccess({ feed: action.feed })),
          catchError((error) => of(FeedActions.updateFeedFailure({ error })))
        )
      )
    )
  );
}
