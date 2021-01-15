import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TextService {
  splitIntoLines(element, text): string[] {
    const lines: string[] = [];

    text.split(' ').reduce((pref: string, current: string) => {
      element.innerText = this.concatString(pref, element.innerText, current);

      if (element.scrollWidth > element.clientWidth) {
        lines.push(element.innerText);
        element.innerText = '';
        return current; // todo hyphenate and check again
      }
      return '';
    }, '');
    element.innerText = '';

    return lines;
  }

  private concatString(prev: string, dummy: string, current: string): string {
    if (prev) {
      return prev.concat(' ', dummy, ' ', current);
    } else {
      return dummy.concat(' ', current);
    }
  }
}
