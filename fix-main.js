const fs = require('fs');
let mainTs = fs.readFileSync('src/main.ts', 'utf8');

mainTs = mainTs.replace(/@angular\/fire/g, '@angular/fire/compat');
mainTs = mainTs.replace(/firebaseConfig/g, 'firebase');

fs.writeFileSync('src/main.ts', mainTs);
