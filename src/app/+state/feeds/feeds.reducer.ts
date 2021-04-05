import { Feed } from '../../model/feed';
import { createReducer, on } from '@ngrx/store';
import { loadFeeds, loadFeedsSuccess } from './feeds.actions';
import { loadSettingsFailure } from '../settings/settings.actions';

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
  on(loadSettingsFailure, (state, { error }) => ({
    ...state,
    error,
    isLoaded: true,
  }))
);
