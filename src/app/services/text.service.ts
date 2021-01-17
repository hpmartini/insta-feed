import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TextService {
  splitIntoLines(element, text): string[] {
    const lines: string[] = [];

    // iterate over each word in the text and
    // add them into lines according to the length
    // of the reference element
    text.split(' ').reduce((pref: string, current: string) => {
      element.innerText = this.concatString(pref, element.innerText, current);

      // when end of line is reached
      if (this.isEndOFLineReached(element)) {
        // add text to result array
        lines.push(element.innerText);
        // reset dummy element text
        element.innerText = '';

        // return current word to be used in the next lind
        return current; // todo hyphenate and check again
      }

      // return an empty string to go ahead
      // with the next word in the current line
      return '';
    });

    // reset dummy element text
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

  private isEndOFLineReached(element): boolean {
    return element.scrollWidth > element.clientWidth;
  }
}
