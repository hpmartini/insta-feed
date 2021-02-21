import {Component} from '@angular/core';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
import {Observable} from 'rxjs';
import {map, shareReplay} from 'rxjs/operators';

export interface NavEntry {
  title: string;
  link: string;
  icon?: string;
}

// todo persist and get from firebase
export const navEntries: NavEntry[] = [
  {
    title: 'Süddeutsche', link: 'rss.sueddeutsche.de/rss/Topthemen', icon: 'panorama_photosphere',
  },
  {
    title: 'Tagesschau', link: 'tagesschau.de/xml/rss2', icon: 'article'
  },
  {
    title: 'Zeit', link: 'newsfeed.zeit.de/index', icon: 'alarm'
  }
];

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.sass'],
})
export class NavComponent {
  public navEntries = navEntries;

  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(
      map((result) => result.matches),
      shareReplay()
    );

  constructor(private breakpointObserver: BreakpointObserver) {
  }
}
