import { createAction, props } from '@ngrx/store';
import { Feed } from '../../model/feed';

const LOAD_FEEDS = '[Facade] LoadFeeds';
const LOAD_FEEDS_SUCCESS = '[Facade] LoadFeeds Success';
const LOAD_FEEDS_ERROR = '[Facade] LoadFeeds Failure';

const ADD_FEED = '[Facade] AddFeed';
const ADD_FEED_SUCCESS = '[Facade] AddFeed Success';
const ADD_FEED_ERROR = '[Facade] AddFeed Failure';

const DELETE_FEED = '[Facade] DeleteFeed';
const DELETE_FEED_SUCCESS = '[Facade] DeleteFeed Success';
const DELETE_FEED_ERROR = '[Facade] DeleteFeed Failure';

const UPDATE_FEED = '[Facade] UpdateFeed';
const UPDATE_FEED_SUCCESS = '[Facade] UpdateFeed Success';
const UPDATE_FEED_ERROR = '[Facade] UpdateFeed Failure';

export const loadFeeds = createAction(LOAD_FEEDS);
export const addFeed = createAction(ADD_FEED);
export const deleteFeed = createAction(DELETE_FEED);
export const updateFeed = createAction(UPDATE_FEED);

export const loadFeedsSuccess = createAction(
  LOAD_FEEDS_SUCCESS,
  props<{ feeds: Feed[] }>()
);

export const loadFeedsFailure = createAction(
  LOAD_FEEDS_ERROR,
  props<{ error: string }>()
);

export const addFeedSuccess = createAction(
  ADD_FEED_SUCCESS,
  props<{ feeds: Feed }>()
);

export const addFeedFailure = createAction(
  ADD_FEED_ERROR,
  props<{ error: string }>()
);

export const deleteFeedSuccess = createAction(
  DELETE_FEED_SUCCESS,
  props<{ feeds: Feed }>()
);

export const deleteFeedFailure = createAction(
  DELETE_FEED_ERROR,
  props<{ error: string }>()
);

export const updateFeedSuccess = createAction(
  UPDATE_FEED_SUCCESS,
  props<{ feeds: Feed }>()
);

export const updateFeedFailure = createAction(
  UPDATE_FEED_ERROR,
  props<{ error: string }>()
);
