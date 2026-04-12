const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath, callback);
        } else {
            callback(fullPath);
        }
    }
}

// 1. Make components standalone
walk('src', (filepath) => {
    if (filepath.endsWith('.component.ts') || filepath.endsWith('.dialog.ts')) {
        let content = fs.readFileSync(filepath, 'utf8');
        if (content.includes('@Component(') && !content.includes('standalone: true')) {
            content = content.replace(/@Component\(\s*{/, '@Component({\n  standalone: true,\n  imports: [/* Add your imports here */],\n');
            fs.writeFileSync(filepath, content);
        }
    }
    
    // 2. replace async with waitForAsync in tests
    if (filepath.endsWith('.spec.ts')) {
        let content = fs.readFileSync(filepath, 'utf8');
        if (content.includes('async(')) {
            content = content.replace(/import\s*{\s*([^}]*)\basync\b([^}]*)\s*}\s*from\s*['"]@angular\/core\/testing['"]/g, (match, p1, p2) => {
                let inner = [p1, 'waitForAsync', p2].filter(x => x && x.trim()).join(', ');
                return `import { ${inner} } from '@angular/core/testing'`;
            });
            content = content.replace(/\basync\b\(/g, 'waitForAsync(');
            fs.writeFileSync(filepath, content);
        }
    }

    // 3. Injectable services
    if (filepath.endsWith('.service.ts')) {
        let content = fs.readFileSync(filepath, 'utf8');
        if (content.includes('@Injectable(') && !content.includes("providedIn: 'root'")) {
            content = content.replace(/@Injectable\(\s*\)/g, "@Injectable({\n  providedIn: 'root'\n})");
            fs.writeFileSync(filepath, content);
        } else if (content.includes('@Injectable()')) {
            content = content.replace(/@Injectable\(\)/g, "@Injectable({\n  providedIn: 'root'\n})");
            fs.writeFileSync(filepath, content);
        }
    }
});

// 4. Update main.ts for bootstrapApplication
const mainTsPath = 'src/main.ts';
let mainTs = fs.readFileSync(mainTsPath, 'utf8');
mainTs = `
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { importProvidersFrom, isDevMode } from '@angular/core';
import { AppRoutingModule } from './app/app-routing.module';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { AngularFireModule } from '@angular/fire';
import { environment } from './environments/environment';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FIREBASE_OPTIONS } from '@angular/fire';
// Import reducers, effects, etc. as needed

if (environment.production) {
  // enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      BrowserAnimationsModule,
      AppRoutingModule,
      AngularFireModule.initializeApp(environment.firebaseConfig),
      StoreModule.forRoot({}), // Add reducers
      EffectsModule.forRoot([]) // Add effects
    ),
    { provide: FIREBASE_OPTIONS, useValue: environment.firebaseConfig }
  ]
}).catch(err => console.error(err));
`;
fs.writeFileSync(mainTsPath, mainTs);

// 5. MatSliderThumb fix in HTML
walk('src', (filepath) => {
    if (filepath.endsWith('.html')) {
        let content = fs.readFileSync(filepath, 'utf8');
        let modified = false;
        if (content.includes('matSliderThumb')) {
            // Replace matSliderThumb with matSliderThumb #matSliderThumb="matSliderThumb" 
            // Or fix ngModel reference
            content = content.replace(/<input([^>]*)matSliderThumb([^>]*)>/g, (match, p1, p2) => {
                if (!match.includes('#matSliderThumb')) {
                    return `<input${p1}matSliderThumb #matSliderThumb="matSliderThumb"${p2}>`;
                }
                return match;
            });
            modified = true;
        }
        if (modified) fs.writeFileSync(filepath, content);
    }
});
