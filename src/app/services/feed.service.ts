import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AngularFireFunctions } from '@angular/fire/functions';

@Injectable()
export class FeedService {
  constructor(private readonly functions: AngularFireFunctions) {}

  getFeedContent(url: string): Observable<string> {
    console.log('getFeed');
    const getFeed = this.functions.httpsCallable('getFeed');
    let content = '';
    getFeed({ url }).subscribe(
      (result) => {
        console.log('result', result);
        return (content = result?.data);
      },
      (error) => console.log(error)
    );
    console.log(content);

    // return this.http.get(url, {responseType: 'text'});
    return of(content);
  }

  extractFeeds(response: any): any {
    // const parser = new xml2js.Parser({explicitArray : false, mergeAttrs : true});
    // let feed: any;
    // parser.parseString(response, (err: any, result: any) => {
    //   if (err) {
    //     console.warn(err);
    //   }
    //   feed = result;
    // });
    //
    // return feed?.rss?.channel?.item[0] ?? {};
    return null;
  }
}
