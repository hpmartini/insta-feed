import { Injectable } from '@angular/core';

declare const require: any;
const Hypher = require('hypher');
const german = require('hyphenation.de');
const english = require('hyphenation.en-us');

export type SupportedLanguage = 'de' | 'en';

@Injectable({
  providedIn: 'root'
})
export class ChunkingService {
  private hypherDe: any;
  private hypherEn: any;

  constructor() {
    this.hypherDe = new Hypher(german);
    this.hypherEn = new Hypher(english);
  }

  /**
   * Splits words in the text with soft hyphens (\u00AD) according to the selected language.
   */
  public hyphenateText(text: string, language: SupportedLanguage = 'de'): string {
    if (!text) {
      return '';
    }
    const hypher = language === 'en' ? this.hypherEn : this.hypherDe;
    return hypher.hyphenateText(text);
  }

  /**
   * Returns an array of syllables for a single word.
   */
  public hyphenateWord(word: string, language: SupportedLanguage = 'de'): string[] {
    if (!word) {
      return [];
    }
    const hypher = language === 'en' ? this.hypherEn : this.hypherDe;
    return hypher.hyphenate(word);
  }
}
