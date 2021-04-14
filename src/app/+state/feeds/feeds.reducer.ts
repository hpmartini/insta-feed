import { Feed } from '../../model/feed';
import { Action, createReducer, on } from '@ngrx/store';
import {
  addFeed,
  addFeedFailure,
  addFeedSuccess,
  deleteFeed,
  deleteFeedFailure,
  deleteFeedSuccess,
  loadFeeds,
  loadFeedsFailure,
  loadFeedsSuccess,
  updateFeed,
  updateFeedFailure,
  updateFeedSuccess,
} from './feeds.actions';

export const feedsFeatureKey = 'feeds';

export interface FeedsState {
  feeds: Feed[];
  isLoaded: boolean;
  error?: string | null;
}

export interface FeedsPartialState {
  readonly [feedsFeatureKey]: FeedsState;
}

export const initialState: FeedsState = {
  feeds: [],
  isLoaded: false,
};

export const feedReducer = createReducer(
  initialState,
  // load
  on(loadFeeds, (state) => ({
    ...state,
    isLoaded: false,
    error: null,
  })),
  on(loadFeedsSuccess, (state, { feeds }) => ({
    ...state,
    feeds,
    isLoaded: true,
    error: null,
  })),
  on(loadFeedsFailure, (state, { error }) => ({
    ...state,
    error,
    isLoaded: true,
  })),
  // add
  on(addFeed, (state) => ({
    ...state,
    isLoaded: false,
    error: null,
  })),
  on(addFeedSuccess, (state, { addedFeed: addedFeed }) => {
    const feeds = state.feeds.map((feed) => feed);
    feeds.push(addedFeed);
    return {
      ...state,
      feeds,
      isLoaded: true,
      error: null,
    };
  }),
  on(addFeedFailure, (state, { error }) => ({
    ...state,
    error,
    isLoaded: true,
  })),
  // delete
  on(deleteFeed, (state) => ({
    ...state,
    isLoaded: false,
    error: null,
  })),
  on(deleteFeedSuccess, (state, { feed: feed }) => ({
    ...state,
    feeds: state.feeds.filter((f) => f.name !== feed.name),
    isLoaded: true,
    error: null,
  })),
  on(deleteFeedFailure, (state, { error }) => ({
    ...state,
    error,
    isLoaded: true,
  })),
  // update
  on(updateFeed, (state) => ({
    ...state,
    isLoaded: false,
    error: null,
  })),
  on(updateFeedSuccess, (state, { feed: updatedFeed }) => ({
    ...state,
    feeds: state.feeds.map((feed) =>
      feed.name === updatedFeed.name ? updatedFeed : feed
    ),
    isLoaded: true,
    error: null,
  })),
  on(updateFeedFailure, (state, { error }) => ({
    ...state,
    error,
    isLoaded: true,
  }))
);

export function reducer(
  state: FeedsState | undefined,
  action: Action
): FeedsState {
  return feedReducer(state, action);
}
