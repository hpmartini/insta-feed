import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

const firebase = require('firebase');

@Injectable()
export class FeedService {
  constructor(private http: HttpClient) {}

  getFeedContent(url: string): Observable<string> {
    const getFeed = firebase.functions().httpsCallable('getFeed');
    let content = '';
    getFeed({url}).then((result) => content = result.data);
    console.log(content);

    // return this.http.get(url, {responseType: 'text'});
    return null;
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
