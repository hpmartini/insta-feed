import { createFeatureSelector, createSelector } from '@ngrx/store';
import {
  feedsFeatureKey,
  FeedsPartialState,
  FeedsState,
} from './feeds.reducer';

export const getFeedsState = createFeatureSelector<
  FeedsPartialState,
  FeedsState
>(feedsFeatureKey);

export const getFeedsIsLoaded = createSelector(
  getFeedsState,
  (state: FeedsState) => state.isLoaded
);

export const getFeedsError = createSelector(
  getFeedsState,
  (state: FeedsState) => state.error
);

export const getAllFeeds = createSelector(
  getFeedsState,
  (state: FeedsState) => state.feeds
);
