import * as functions from 'firebase-functions';
import * as express from 'express';
import * as cors from 'cors';
import * as Parser from 'rss-parser';

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
