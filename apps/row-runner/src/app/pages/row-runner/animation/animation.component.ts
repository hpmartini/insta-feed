import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { concatMap, delay, map } from 'rxjs/operators';
import { from, Observable, of, Subscription } from 'rxjs';
import { Hypher } from 'hypher';

@Component({
  selector: 'insta-feed-animation',
  templateUrl: './animation.component.html',
  styleUrls: ['./animation.component.sass'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnimationComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('rowRunner', { static: false }) rowRunner: ElementRef;

  @Input() inputText: string;
  @Input() speed: number;

  public output: string;

  private animation: Subscription;
  private lineBreak = '\n';
  private caret = '▉';

  constructor(private ref: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.output = this.caret;
  }

  ngAfterViewInit(): void {
    this.animation = from(this.inputText.split(' '))
      .pipe(
        // sequentially subscribe to the processing of each word of the input array
        concatMap((word) => this.processWord(word)),
        // initial delay
        delay(200)
      )
      .subscribe();
  }

  /***
   * Process one word at a time
   * @param word The current word to be animated
   * @private
   */
  private processWord(word: string): Observable<string> {
    // sequentially process the current word and each of its characters
    return of(word).pipe(
      // add the word to the output and hyphenate it if necessary
      map((value) => this.checkForHyphenation(value)),
      // sequentially place each character to the output with delay
      concatMap((newWord) =>
        from(newWord).pipe(
          concatMap((char) => of(this.animate(char)).pipe(delay(this.speed)))
        )
      )
    );
  }

  /***
   * Check if the current word has to be hyphenated
   * @param word The current word
   * @private
   */
  private checkForHyphenation(word: string): string {
    // add the current word to the output
    this.output = this.output.slice(0, -1);
    this.output += word;

    // check if the output reaches the end of the line
    if (this.isEndOFLineReached()) {
      const hyphenatedWord = this.hyphenate(word).concat(' ');
      this.output += this.caret;
      return hyphenatedWord;
    }

    // remove the current word from the output
    this.output = this.output.slice(0, -word.length);
    this.output += this.caret;

    return word.concat(' ');
  }

  /***
   * Returns the current word hyphenated with a newline character after the hyphen.
   * Or in case the word has only one syllable, the word will be returned with a preceding new line character
   * @param word The current word
   * @private
   */
  private hyphenate(word: string): string {
    let result = '';

    // remove word from output
    this.output = this.output.slice(0, -word.length);

    // get syllables of word as array
    const syllables: string[] = Hypher.hyphenate(word);

    // if the word has only one syllable
    // return it and with a preceding linebreak
    if (syllables.length === 1) {
      return this.lineBreak.concat(word);
    }

    let hyphenatedWord = '';
    // iterate through syllables
    for (const syllable of syllables) {
      // add a hyphen to simulate the resulting length
      this.output += syllable.concat(syllable.slice(0, -1) === '-' ? '' : '-');
      this.ref.detectChanges();

      const index = syllables.indexOf(syllable);
      // check if the end of the line is reached
      if (this.isEndOFLineReached()) {
        result = this.getConcatenatedSyllables(
          hyphenatedWord,
          index,
          syllables
        );
        this.removeSyllablesFromOutput(index, hyphenatedWord, syllable);

        break;
      }

      // remove the previously added hyphen
      this.output = this.output.slice(0, -1);

      // save the current syllable
      hyphenatedWord += syllable;
    }

    return result;
  }

  /***
   * remove the tested syllables from the output
   * @param index
   * @param hyphenatedWord
   * @param syllable
   * @private
   */
  private removeSyllablesFromOutput(
    index: number,
    hyphenatedWord: string,
    syllable: string
  ): void {
    this.output = this.output.slice(
      0,
      -(index ? hyphenatedWord.concat(syllable).length : syllable.length) - 1
    );
  }

  /***
   * Combine the syllables left of the hyphen with the syllables right of the hyphen
   * @param hyphenatedWord
   * @param index
   * @param syllables
   * @private
   */
  private getConcatenatedSyllables(
    hyphenatedWord: string,
    index: number,
    syllables: string[]
  ): string {
    return hyphenatedWord.concat(
      index ? '-' : '',
      this.lineBreak,
      syllables.slice(index, syllables.length).join('')
    );
  }

  /***
   * Add the current character to the output anc clears it, if the end of the page is reached
   * @param char The current character
   * @private
   */
  private animate(char: string): string {
    this.placeCharacterAndCaret(char);
    this.clearIfEndOfPage();
    return char;
  }

  /***
   * Place a character and a caret in front of it to the output
   * @param char The current character
   * @private
   */
  private placeCharacterAndCaret(char: string): void {
    this.output = this.output.slice(0, -2);
    this.output += char.concat(' ', this.caret);
    this.ref.detectChanges();
  }

  /***
   * Check if the animation has reached the end of the line
   * @private
   */
  private isEndOFLineReached(): boolean {
    this.ref.detectChanges();
    const element = this.rowRunner.nativeElement;
    return element.scrollWidth > element.clientWidth;
  }

  /***
   * Clear the text output if the end of the page has been reached
   * @private
   */
  private clearIfEndOfPage(): void {
    const documentElement = document.documentElement;
    if (documentElement.scrollHeight > documentElement.clientHeight) {
      this.output = '';
    }
  }

  /***
   * Stop the animation and clear the output
   */
  ngOnDestroy(): void {
    this.animation.unsubscribe();
    this.output = '';
  }
}
