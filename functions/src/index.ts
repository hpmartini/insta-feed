import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
import * as Parser from 'rss-parser';

admin.initializeApp();

const fetch = require('node-fetch');

const app = express();
const parser = new Parser();

const FEEDS = 'feeds';

app.use(cors({ origin: true }));

exports.getFeed = functions.https.onCall(
  async (data) => await parser.parseURL(data.url)
);

exports.getArticle = functions.https.onCall(async (data) =>
  fetch(data.url).then((response: any) => response.text())
);
exports.addOrUpdateFeed = functions.https.onCall(async (data) =>
  admin
    .firestore()
    .collection(FEEDS)
    .doc(data.name)
    .set(
      {
        name: data.name,
        url: data.url,
        icon: data.icon ?? 'article',
      },
      { merge: true }
    )
);

exports.addSubscribedUserToFeed = functions.firestore
  .document('feeds/{name}')
  .onCreate((snapshot, context) => {
    const uid = context.auth?.uid;

    if (!uid) {
      throw new Error('Invalid authentication');
    }

    return admin
      .firestore()
      .collection(FEEDS)
      .doc(name)
      .update({
        subscribingUsers: admin.firestore.FieldValue.arrayUnion(uid),
      });
  });

exports.unsubscribeFeed = functions.https.onCall((data, context) => {
  const uid = context.auth?.uid;

  if (!uid) {
    throw new Error('Invalid authentication');
  }

  return admin
    .firestore()
    .collection(FEEDS)
    .doc(data.name)
    .update({
      subscribingUsers: admin.firestore.FieldValue.arrayRemove(uid),
    });
});

exports.deleteFeed = functions.https.onCall(async (data) =>
  admin.firestore().collection(FEEDS).doc(data.name).delete()
);

exports.getFeedList = functions.https.onCall(() =>
  admin
    .firestore()
    .collection(FEEDS)
    .get()
    .then((snapshot) => snapshot.docs.map((doc) => doc.data()))
);

exports.loadSettings = functions.https.onCall(async () =>
  admin
    .firestore()
    .collection('user')
    .doc('settings')
    .get()
    .then((snapshot) => snapshot.data())
);

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
      { merge: true }
    )
);
