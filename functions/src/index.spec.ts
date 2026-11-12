import * as admin from 'firebase-admin';

// Mock firebase-functions
jest.mock('firebase-functions/v1', () => {
  const https = {
    onCall: jest.fn((handler) => handler),
    HttpsError: class HttpsError extends Error {
      constructor(public code: string, message: string) {
        super(message);
      }
    },
  };
  return {https, runWith: jest.fn(() => ({https}))};
});

jest.mock('node-fetch', () => jest.fn());

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const firestoreMock = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    set: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    add: jest.fn(),
  };
  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(jest.fn(() => firestoreMock), {
      FieldValue: {
        arrayUnion: jest.fn(),
        arrayRemove: jest.fn(),
        serverTimestamp: jest.fn().mockReturnValue('server_timestamp'),
      },
    }),
  };
});

const myFunctions = require('./index');

describe('Firebase functions', () => {
  let firestoreMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    firestoreMock = admin.firestore();
  });

  describe('loadSettings', () => {
    it('should throw unauthenticated if not logged in', async () => {
      await expect(myFunctions.loadSettings({}, {})).rejects.toThrow('only authenticated users can subscribe to feeds');
    });

    it('should return settings for the authenticated user', async () => {
      const mockData = { speed: 5, defaultFeed: 'feed1' };
      firestoreMock.get.mockResolvedValueOnce({ data: () => mockData });

      const context = { auth: { uid: 'user123' } };
      const result = await myFunctions.loadSettings({}, context);

      expect(firestoreMock.doc).toHaveBeenCalledWith('users/user123/settings/preferences');
      expect(result).toEqual(mockData);
    });
  });

  describe('saveSettings', () => {
    it('should throw unauthenticated if not logged in', async () => {
      await expect(myFunctions.saveSettings({}, {})).rejects.toThrow('only authenticated users can subscribe to feeds');
    });

    it('should set settings for the authenticated user', async () => {
      firestoreMock.set.mockResolvedValueOnce(undefined);

      const context = { auth: { uid: 'user123' } };
      const data = { speed: 10, defaultFeed: 'feed2' };
      
      await myFunctions.saveSettings(data, context);

      expect(firestoreMock.doc).toHaveBeenCalledWith('users/user123/settings/preferences');
      expect(firestoreMock.set).toHaveBeenCalledWith(data, { merge: true });
    });
    
    it('should set null for missing fields', async () => {
      firestoreMock.set.mockResolvedValueOnce(undefined);

      const context = { auth: { uid: 'user123' } };
      const data = {};
      
      await myFunctions.saveSettings(data, context);

      expect(firestoreMock.doc).toHaveBeenCalledWith('users/user123/settings/preferences');
      expect(firestoreMock.set).toHaveBeenCalledWith({ speed: null, defaultFeed: null }, { merge: true });
    });
  });

  describe('saveComprehensionScore', () => {
    it('should throw if not authenticated', async () => {
      await expect(myFunctions.saveComprehensionScore({}, {})).rejects.toThrow();
    });

    it('should calculate passRate, adjust speed, and save score', async () => {
      firestoreMock.get.mockResolvedValueOnce({ data: () => ({ speed: 30 }) });
      firestoreMock.add.mockResolvedValueOnce(undefined);
      
      const context = { auth: { uid: 'user123' } };
      const data = { score: 4, totalQuestions: 5, articleUrl: 'http://test' }; // 80% passRate
      
      const result = await myFunctions.saveComprehensionScore(data, context);

      expect(firestoreMock.collection).toHaveBeenCalledWith('users/user123/scores');
      expect(firestoreMock.add).toHaveBeenCalledWith(expect.objectContaining({
        articleUrl: 'http://test',
        score: 4,
        totalQuestions: 5,
        passRate: 0.8,
      }));
      
      expect(firestoreMock.doc).toHaveBeenCalledWith('users/user123/settings/preferences');
      expect(firestoreMock.set).toHaveBeenCalledWith({ speed: 28 }, { merge: true });
      expect(result).toEqual({ success: true, newSpeed: 28 });
    });
    
    it('should increase delay (decrease speed) if passRate < 80%', async () => {
      firestoreMock.get.mockResolvedValueOnce({ data: () => ({ speed: 30 }) });
      firestoreMock.add.mockResolvedValueOnce(undefined);
      
      const context = { auth: { uid: 'user123' } };
      const data = { score: 3, totalQuestions: 5, articleUrl: 'http://test' }; // 60% passRate
      
      const result = await myFunctions.saveComprehensionScore(data, context);

      expect(firestoreMock.set).toHaveBeenCalledWith({ speed: 32 }, { merge: true });
      expect(result).toEqual({ success: true, newSpeed: 32 });
    });
  });

  describe('generateMicroQuiz', () => {
    const fetchMock = require('node-fetch') as jest.Mock;
    const context = { auth: { uid: 'user123' } };
    const question = { question: 'Worum geht es?', options: ['A', 'B', 'C', 'D'], correctIndex: 2 };
    const answer = (payload: unknown) => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: typeof payload === 'string' ? payload : JSON.stringify(payload) }] } }],
      }),
    });
    const call = (data: any = { text: 'Ein Artikel.' }, ctx: any = context) =>
      myFunctions.generateMicroQuiz(data, ctx);

    beforeEach(() => {
      process.env.GEMINI_API_KEY = 'test-key';
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => {
      delete process.env.GEMINI_API_KEY;
    });

    it('rejects callers that are not signed in, without calling the model', async () => {
      await expect(call({ text: 'x' }, {})).rejects.toThrow('only authenticated users');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects missing or non-string text', async () => {
      await expect(call({})).rejects.toThrow('Extracted text is required');
      await expect(call({ text: 42 })).rejects.toThrow('Extracted text is required');
      await expect(call({ text: '   ' })).rejects.toThrow('Extracted text is required');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fails without the secret instead of falling back to a mock', async () => {
      delete process.env.GEMINI_API_KEY;
      await expect(call()).rejects.toMatchObject({ code: 'failed-precondition' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends the article to Gemini and returns the validated questions', async () => {
      fetchMock.mockResolvedValueOnce(answer({ questions: [{ ...question, extra: 'dropped' }] }));

      await expect(call()).resolves.toEqual({ questions: [question] });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('gemini-2.5-flash:generateContent');
      expect(url).not.toContain('test-key');
      expect(init.headers['x-goog-api-key']).toBe('test-key');
      const body = JSON.parse(init.body);
      expect(body.contents[0].parts[0].text).toContain('<article>\nEin Artikel.\n</article>');
      expect(body.generationConfig.responseMimeType).toBe('application/json');
    });

    it('caps the article length sent to the model', async () => {
      fetchMock.mockResolvedValueOnce(answer({ questions: [question] }));
      await call({ text: 'a'.repeat(50000) });
      const sent = JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text;
      expect(sent.match(/a+/g).sort((x: string, y: string) => y.length - x.length)[0]).toHaveLength(12000);
    });

    it('keeps at most two questions', async () => {
      fetchMock.mockResolvedValueOnce(answer({ questions: [question, question, question] }));
      expect((await call()).questions).toHaveLength(2);
    });

    it.each([
      ['no JSON', 'not json'],
      ['no questions', { questions: [] }],
      ['three options', { questions: [{ ...question, options: ['A', 'B', 'C'] }] }],
      ['empty option', { questions: [{ ...question, options: ['A', 'B', 'C', ' '] }] }],
      ['index out of range', { questions: [{ ...question, correctIndex: 4 }] }],
      ['index not an integer', { questions: [{ ...question, correctIndex: '1' }] }],
      ['empty question', { questions: [{ ...question, question: '' }] }],
    ])('rejects an invalid model answer: %s', async (_name, payload) => {
      fetchMock.mockResolvedValueOnce(answer(payload));
      await expect(call()).rejects.toMatchObject({ code: 'internal' });
    });

    it('maps transport errors and non-2xx answers to unavailable, without upstream details', async () => {
      fetchMock.mockRejectedValueOnce(new Error('socket hang up test-key'));
      await expect(call()).rejects.toMatchObject({ code: 'unavailable', message: 'Quiz generation failed.' });
      fetchMock.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
      await expect(call()).rejects.toMatchObject({ code: 'unavailable', message: 'Quiz generation failed.' });
    });
  });
});
