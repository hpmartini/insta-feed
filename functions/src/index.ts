import * as functions from 'firebase-functions';
import * as express from 'express';
import * as cors from 'cors';
import * as https from 'https';
import * as Parser from 'rss-parser';

const Readability = require('@mozilla/readability');
const jsdom = require('jsdom').JSDOM;

const app = express();
const parser = new Parser();

app.use(cors({ origin: true }));

app.get('/:id', (req, res) => res.send(req.params.id));
app.post('/', (req, res) =>
  parser.parseURL(req.body.url).then((result: any) =>
    https.get(result.items[0].link, (incomingMessage) => {
      let body = '';
      incomingMessage.on('data', (data) => (body += data));
      return incomingMessage.on('end', () => {
        const doc = new jsdom(body, result.items[0].link);
        const reader = new Readability(doc.window.document);
        const article = reader.parse();
        res.send({
          url: result.items[0].link,
          title: article.title,
          excerpt: article.excerpt,
          content: article.content,
          textContent: article.textContent,
          siteName: article.siteName,
        });
      });
    })
  )
);

exports.loadFeed = functions.https.onRequest(app);

exports.getFeed = functions.https.onCall((data) =>
  https.get(data.url, (incomingMessage) => {
    let body = '';
    incomingMessage.on('data', (incomingData) => (body += incomingData));
    return incomingMessage.on('end', () => body);
  })
);
