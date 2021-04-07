import { Feed } from '../../model/feed';
import { Action, createReducer, on } from '@ngrx/store';
import {
  loadFeeds,
  loadFeedsFailure,
  loadFeedsSuccess,
  addFeed,
  addFeedSuccess,
  addFeedFailure,
  deleteFeed,
  deleteFeedSuccess,
  deleteFeedFailure,
  updateFeed,
  updateFeedSuccess,
  updateFeedFailure,
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
  on(addFeedSuccess, (state, { feeds: feed }) => {
    const feeds = state.feeds;
    feeds.push(feed);
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
  on(deleteFeedSuccess, (state, { feeds: feed }) => {
    const feeds = state.feeds;
    feeds.splice(feeds.indexOf(feed));
    return {
      ...state,
      feeds,
      isLoaded: true,
      error: null,
    };
  }),
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
  on(updateFeedSuccess, (state, { feeds: feed }) => {
    const feeds = state.feeds;
    feeds.splice(feeds.indexOf(feed)).push(feed);
    return {
      ...state,
      feeds,
      isLoaded: true,
      error: null,
    };
  }),
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
