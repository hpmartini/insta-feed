import { Component } from '@angular/core';
import { Feed } from '../../model/feed';

@Component({
  selector: 'insta-feed-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.sass'],
})
export class HomeComponent {
  public navEntries: Feed[] = [
    {
      name: 'Süddeutsche',
      url: 'rss.sueddeutsche.de/rss/Topthemen',
      icon: 'panorama_photosphere',
    },
  ];
}
