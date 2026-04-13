import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import Parser from 'rss-parser';
import { CallableContext } from 'firebase-functions/v1/https';

admin.initializeApp();

const fetch = require('node-fetch');
const app = express();
const parser = new Parser();
const FEEDS = 'feeds';

app.use(cors({origin: true}));

/***
 * Parse and return feed by URL
 */
exports.getFeed = functions.https.onCall(
  async (data: any) => await parser.parseURL(data.url)
);

/***
 * Fetch article from feed an return its text, acting as reverse proxy
 * in order to prevent CORS errors
 */
exports.getArticle = functions.https.onCall(async (data: any) =>
  fetch(data.url).then((response: any) => response.text())
);

/***
 * Add new or update feed, adding the current user as subscriber
 */
exports.setFeed = functions.https.onCall(async (data: any, context: CallableContext) =>
  admin
    .firestore()
    .collection(FEEDS)
    .doc(removeSlashesFromUrl(data.url))
    .set(
      {
        name: data.name,
        url: data.url,
        icon: data.icon ?? 'article',
        subscribers: admin.firestore.FieldValue.arrayUnion(getUid(context)),
      },
      {merge: true}
    )
);

/***
 * Unsubscribe feed by removing the current user from the feeds subscriber list
 */
exports.unsubscribe = functions.https.onCall((data: any, context: CallableContext) =>
  admin
    .firestore()
    .collection(FEEDS)
    .doc(removeSlashesFromUrl(data.url))
    .update({
      subscribers: admin.firestore.FieldValue.arrayRemove(getUid(context)),
    }));

/***
 * TODO convert to trigger or remove
 */
exports.deleteFeed = functions.https.onCall(async (data: any) =>
  admin.firestore().collection(FEEDS).doc(removeSlashesFromUrl(data.url)).delete()
);

/***
 * Return the list of feeds subscribed by the current user
 */
exports.getFeedList = functions.https.onCall((data: any, context: CallableContext) =>
  admin
    .firestore()
    .collection(FEEDS)
    .where('subscribers', 'array-contains', getUid(context))
    .get()
    .then((snapshot) => snapshot.docs
      .map((doc) => doc.data()))
);

/***
 * TODO personalize
 */
exports.loadSettings = functions.https.onCall(async (data: any, context: CallableContext) =>
  admin
    .firestore()
    .doc(`users/${getUid(context)}/settings/preferences`)
    .get()
    .then((snapshot) => snapshot.data())
);

/***
 * TODO personalize
 */
exports.saveSettings = functions.https.onCall(async (data: any, context: CallableContext) =>
  admin
    .firestore()
    .doc(`users/${getUid(context)}/settings/preferences`)
    .set(
      {
        speed: data.speed ?? null,
        defaultFeed: data.defaultFeed ?? null,
      },
      {merge: true}
    )
);

/***
 * Return UID or throw unauthenticated exception
 */
function getUid(context: CallableContext): string {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'only authenticated users can subscribe to feeds'
    );
  }
  return uid;
}

/***
 * Remove slashes to use URL as identifier
 */
function removeSlashesFromUrl(url: string): string {
  return url
    .replace(/https?:\/\/(www\.)?/, '')
    .replace(/\/$/, '')
    .replace(/\//g, '_');
}
