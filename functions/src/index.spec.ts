import * as admin from 'firebase-admin';

// Mock firebase-functions
jest.mock('firebase-functions/v1', () => {
  return {
    https: {
      onCall: jest.fn((handler) => handler),
      HttpsError: class HttpsError extends Error {
        constructor(code: string, message: string) {
          super(message);
        }
      }
    }
  };
});

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
        serverTimestamp: jest.fn().mockReturnValue('server_timestamp')
      }
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
        passRate: 0.8
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
});
