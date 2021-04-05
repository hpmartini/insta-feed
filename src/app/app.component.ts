import { Component, OnInit } from '@angular/core';
import { SettingsFacade } from './+state/settings/settings.facade';
import { FeedsFacade } from './+state/feeds/feeds.facade';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass'],
})
export class AppComponent implements OnInit {
  title = 'insta-feed';

  constructor(
    private readonly settingsFacade: SettingsFacade,
    private readonly feedsFacade: FeedsFacade
  ) {}

  ngOnInit(): void {
    this.settingsFacade.loadSettings();
    this.feedsFacade.loadFeeds();
  }
}
