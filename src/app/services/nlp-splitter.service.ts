import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NlpSplitterService {
  private readonly stopwords = [
    'the','a','an','in','on','at','with','to','for','of','and','or','is','are','was','were','be','been','being','over','under','into','onto','out','through',
    'der','die','das','ein','eine','einer','eines','einem','einen','mit','auf','zu','von','und','oder','ist','sind','war','waren','über','unter','vor','hinter','aus','nach','im','am','zum','zur','vom','beim'
  ];

  constructor() { }

  public splitIntoChunks(text: string): string[] {
    if (!text) return [];

    const clauses = text.split(/([.,;?!]+)/);
    const chunks: string[] = [];
    
    for (let i = 0; i < clauses.length; i++) {
      const part = clauses[i].trim();
      if (!part) continue;
      
      if (/^[.,;?!]+$/.test(part)) {
        if (chunks.length > 0) {
          chunks[chunks.length - 1] += part;
        } else {
          chunks.push(part);
        }
      } else {
        const words = part.split(/\s+/);
        let currentChunk: string[] = [];
        
        for (let j = 0; j < words.length; j++) {
          const word = words[j];
          currentChunk.push(word);
          
          if (currentChunk.length >= 3) {
             chunks.push(currentChunk.join(' '));
             currentChunk = [];
          } else if (currentChunk.length === 2) {
             const firstWordLower = currentChunk[0].toLowerCase();
             if (!this.stopwords.includes(firstWordLower)) {
               chunks.push(currentChunk.join(' '));
               currentChunk = [];
             }
          } else if (currentChunk.length > 0) {
             if (j + 1 < words.length) {
               const nextWordLower = words[j+1].toLowerCase();
               if (this.stopwords.includes(nextWordLower) && !this.stopwords.includes(currentChunk[0].toLowerCase())) {
                  chunks.push(currentChunk.join(' '));
                  currentChunk = [];
               }
             }
          }
        }
        
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join(' '));
        }
      }
    }
    
    return chunks;
  }
}
