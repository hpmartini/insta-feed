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

/***
 * LLM-based micro-quiz generator. 
 * Takes extracted Readability text and returns 1-2 multiple-choice questions.
 * (Mocked for now, integrate with OpenAI/Vertex AI in production).
 */
exports.generateMicroQuiz = functions.https.onCall(async (data: any, context: CallableContext) => {
  const text = data.text;
  if (!text) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Extracted text is required to generate a quiz.'
    );
  }

  // MOCK LLM behavior
  return {
    questions: [
      {
        question: "Based on the article, what is the main subject?",
        options: ["The primary topic discussed", "An unrelated topic", "A minor detail mentioned once", "Not mentioned"],
        correctIndex: 0
      },
      {
        question: "Which of the following best describes the conclusion?",
        options: ["It ended abruptly", "It summarized the key points", "It asked a question", "No clear conclusion"],
        correctIndex: 1
      }
    ]
  };
});


/***
 * Save comprehension score and adjust reading speed
 */
exports.saveComprehensionScore = functions.https.onCall(async (data: any, context: CallableContext) => {
  const uid = getUid(context);
  const { score, totalQuestions, articleUrl } = data;
  
  if (totalQuestions === 0) return { success: false };

  const passRate = score / totalQuestions;

  // 1. Save the score
  await admin.firestore().collection(`users/${uid}/scores`).add({
    articleUrl: articleUrl || '',
    score,
    totalQuestions,
    passRate,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 2. Adjust speed based on target 80% pass rate
  const prefsRef = admin.firestore().doc(`users/${uid}/settings/preferences`);
  const prefsSnap = await prefsRef.get();
  const prefs = prefsSnap.data() || {};
  
  // Default speed is 30 in the app
  let currentSpeed = prefs.speed || 30;
  
  // Speed is a delay in ms, so lower is faster
  if (passRate >= 0.8) {
    // Increase WPM (decrease delay)
    currentSpeed = Math.max(10, currentSpeed - 2);
  } else {
    // Decrease WPM (increase delay)
    currentSpeed = Math.min(100, currentSpeed + 2);
  }

  await prefsRef.set({ speed: currentSpeed }, { merge: true });

  return { success: true, newSpeed: currentSpeed };
});
