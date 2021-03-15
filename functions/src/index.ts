import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
import * as Parser from 'rss-parser';

admin.initializeApp();

const fetch = require('node-fetch');

const app = express();
const parser = new Parser();

app.use(cors({ origin: true }));

exports.getFeed = functions.https.onCall(
  async (data) => await parser.parseURL(data.url)
);

exports.getArticle = functions.https.onCall(async (data) =>
  fetch(data.url).then((response: any) => response.text())
);

exports.addFeed = functions.https.onCall(async (data) =>
  admin
    .firestore()
    .collection('feeds')
    .doc(data.name)
    .set({
      name: data.name,
      url: data.url,
      icon: data.icon ?? 'article',
    })
);

exports.deleteFeed = functions.https.onCall(async (data) =>
  admin.firestore().collection('feeds').doc(data.name).delete()
);

exports.getFeedList = functions.https.onCall(() =>
  admin
    .firestore()
    .collection('feeds')
    .get()
    .then((snapshot) => snapshot.docs.map((doc) => doc.data()))
);
