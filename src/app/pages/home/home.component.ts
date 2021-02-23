import { Component, OnInit } from '@angular/core';
import { Feed } from '../../model/feed';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.sass'],
})
export class HomeComponent implements OnInit {
  public navEntries: Feed[] = [
    {
      name: 'Süddeutsche',
      url: 'rss.sueddeutsche.de/rss/Topthemen',
      icon: 'panorama_photosphere',
    },
    {
      name: 'Tagesschau',
      url: 'tagesschau.de/xml/rss2',
      icon: 'article',
    },
    {
      name: 'Zeit',
      url: 'newsfeed.zeit.de/index',
      icon: 'alarm',
    },
  ];

  constructor() {}

  ngOnInit(): void {}
}
