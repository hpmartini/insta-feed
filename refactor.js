const fs = require('fs');
// read main.ts
let mainTs = fs.readFileSync('src/main.ts', 'utf8');
mainTs = mainTs.replace(
  /import \{ AngularFireAuth, USE_EMULATOR, AngularFireAuthModule \} from '@angular\/fire\/compat\/auth';/,
  "import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';"
);
mainTs = mainTs.replace(
  /import \{ SETTINGS \} from '@angular\/fire\/compat\/firestore';/,
  "import { provideFirestore, getFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';"
);
mainTs = mainTs.replace(
  /import \{ USE_EMULATOR as FUNCTIONS_EMULATOR, AngularFireFunctionsModule \} from '@angular\/fire\/compat\/functions';/,
  "import { provideFunctions, getFunctions, connectFunctionsEmulator } from '@angular/fire/functions';"
);
mainTs = mainTs.replace(
  /import \{ AngularFireModule \} from '@angular\/fire\/compat';/,
  "import { provideFirebaseApp, initializeApp } from '@angular/fire/app';"
);

mainTs = mainTs.replace(
  /AngularFireModule\.initializeApp\(environment\.firebase, 'ready'\), AngularFireFunctionsModule, AngularFireAuthModule,/,
  ""
);

mainTs = mainTs.replace(
  /AngularFireAuth,/,
  ""
);

mainTs = mainTs.replace(
  /        \{\n            provide: SETTINGS,[\s\S]*?\n        \},/,
  ""
);
mainTs = mainTs.replace(
  /        \{\n            provide: USE_EMULATOR,[\s\S]*?\n        \},/,
  ""
);
mainTs = mainTs.replace(
  /        \{\n            provide: FUNCTIONS_EMULATOR,[\s\S]*?\n        \},/,
  ""
);

mainTs = mainTs.replace(
  /        provideHttpClient\(withInterceptorsFromDi\(\)\),/,
  `        provideFirebaseApp(() => initializeApp(environment.firebase)),
        provideAuth(() => {
          const auth = getAuth();
          if (environment.stage === 'emulator') connectAuthEmulator(auth, 'http://localhost:9099');
          return auth;
        }),
        provideFirestore(() => {
          const firestore = getFirestore();
          if (environment.stage === 'emulator') connectFirestoreEmulator(firestore, 'localhost', 8080);
          return firestore;
        }),
        provideFunctions(() => {
          const functions = getFunctions();
          if (environment.stage === 'emulator') connectFunctionsEmulator(functions, 'localhost', 5001);
          return functions;
        }),
        provideHttpClient(withInterceptorsFromDi()),`
);

fs.writeFileSync('src/main.ts', mainTs);
console.log('main.ts updated');
