import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class ScraperService {
  private lineBreak = '<br/><br/>';
  private parser = new DOMParser();

  constructor(private http: HttpClient) {}

  scrapeTextFromHtml(text: any): Promise<string> {
    if (text?.link) {
      return this.http
        .get(text.link, { responseType: 'text' })
        .toPromise()
        .then((response) => this.getParagraphs(response));
    } else {
      return (
        text?.title.concat(this.lineBreak, this.getDescription(text)) ??
        new Promise<string>(() => '')
      );
    }
  }

  private getDescription(text: any): string {
    return this.parser
      .parseFromString(text.description, 'text/html')
      .getElementsByTagName('p')[0].innerHTML;
  }

  private getParagraphs(response): string {
    const document = this.parser.parseFromString(response, 'text/html');
    // const article = new Readability(document).parse();

    // return ''.concat(article.title, article.excerpt, article.content);
    return null;
  }
}
