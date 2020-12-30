import * as functions from 'firebase-functions';
import * as express from 'express';
import * as cors from 'cors';
import * as https from 'https';
import * as Parser from 'rss-parser';

const app = express();
const parser = new Parser();

app.use(cors({ origin: true }));

app.get('/:id', (req, res) => res.send(req.params.id));
app.post('/', (req, res) =>
  parser.parseURL(req.body.url).then((result: any) =>
    res.send({
      requested_url: req.body.url ?? '',
      result: result,
    })
  )
);

exports.loadFeed = functions.https.onRequest(app);

exports.getFeed = functions.https.onCall((data, context) =>
  https.get(data.url, (incomingMessage) => {
    let body = '';
    incomingMessage.on('data', (incomingData) => (body += incomingData));
    return incomingMessage.on('end', () => body);
  })
);

// exports.loadFeed = functions.https.onRequest((req, res) => {
//   res.send({
//     answer: 'test',
//     requestBody: req.body,
//   });
// });

// app.post('/', async (req, res) => {
//   console.log(req.body);
//   const url = req.body.url;
//   res.send(req.body);
//
//   https.get(url, (response) => {
//     console.log(response);
//     if (response.statusCode !== 200) {
//       console.log(`Error loading HTTPS resource. Code: ${response.statusCode}`);
//
//       res.status(400).json({
//         result: response.statusMessage,
//       });
//       response.resume();
//       return;
//     }
//
//     response.on('data', (data) => {
//       res.status(200).json({
//         result: data,
//       });
//     });
//   });
// });

// exports.getFeed = functions.https.onRequest((req, resp) => {
//   let result = null;
//   app.get(req.url, (request, response) => {
//     console.log(response);
//     result = response;
//   });
//
//   resp.status(200).json({
//     message: 'worked',
//     data: result,
//   });
// });
