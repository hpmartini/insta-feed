import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
import * as Parser from 'rss-parser';
import {CallableContext} from 'firebase-functions/lib/providers/https';

admin.initializeApp();

const fetch = require('node-fetch');
const app = express();
const parser = new Parser();
const FEEDS = 'feeds';

app.use(cors({origin: true}));

interface Feed {
  name: string;
  url: string;
  icon?: string;
}

/***
 * Parse and return feed by URL
 */
exports.getFeed = functions.https.onCall(
  async (data) => await parser.parseURL(data.url)
);

/***
 * Fetch article from feed an return its text, acting as reverse proxy
 * in order to prevent CORS errors
 */
exports.getArticle = functions.https.onCall(async (data) =>
  fetch(data.url).then((response: any) => response.text())
);

/***
 * Add new or update feed, adding the current user as subscriber
 */
exports.setFeed = functions.https.onCall(async (data, context) =>
  admin
    .firestore()
    .collection(FEEDS)
    .doc(removeSlashesFromUrl(data))
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
exports.unsubscribe = functions.https.onCall((data, context) =>
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
exports.deleteFeed = functions.https.onCall(async (data) =>
  admin.firestore().collection(FEEDS).doc(removeSlashesFromUrl(data.url)).delete()
);

/***
 * Return the list of feeds subscribed by the current user
 */
exports.getFeedList = functions.https.onCall((data, context) =>
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
exports.loadSettings = functions.https.onCall(async () =>
  admin
    .firestore()
    .collection('user')
    .doc('settings')
    .get()
    .then((snapshot) => snapshot.data())
);

/***
 * TODO personalize
 */
exports.saveSettings = functions.https.onCall(async (data) =>
  admin
    .firestore()
    .collection('user')
    .doc('settings')
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
  console.log('current user', uid);
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
function removeSlashesFromUrl(feed: Feed): string {
  return feed.url.replace('/', '_');
}
