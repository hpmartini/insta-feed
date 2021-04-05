import { createAction, props } from '@ngrx/store';
import { Feed } from '../../model/feed';

const LOAD_FEEDS = '[Facade] LoadFeeds';
const LOAD_FEEDS_SUCCESS = '[Facade] LoadFeeds Success';
const LOAD_FEEDS_ERROR = '[Facade] LoadFeeds Failure';

export const loadFeeds = createAction(LOAD_FEEDS);

export const loadFeedsSuccess = createAction(
  LOAD_FEEDS_SUCCESS,
  props<{ feeds: Feed[] }>()
);

export const loadFeedsFailure = createAction(
  LOAD_FEEDS_ERROR,
  props<{ error: string }>()
);
