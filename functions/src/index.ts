import * as functions from 'firebase-functions';
import * as express from 'express';
import * as cors from 'cors';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

const app = express();

app.use(cors({origin: true}));

exports.getFeed = functions.https.onCall((data, context) => {
  console.log('data:', data);
  console.log('context', context);

  console.log(data.feed);

  app.get(data.url, (req, res) => {
    console.log(res);
  });
});
