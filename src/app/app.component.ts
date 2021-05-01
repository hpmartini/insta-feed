import {Component, OnInit} from '@angular/core';
import {SettingsFacade} from './+state/settings/settings.facade';
import {FeedsFacade} from './+state/feeds/feeds.facade';
import {AuthService} from './services/auth.service';
import {User} from './model/user';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass'],
})
export class AppComponent implements OnInit {
  title = 'insta-feed';

  constructor(
    private readonly settingsFacade: SettingsFacade,
    private readonly feedsFacade: FeedsFacade,
    private readonly authService: AuthService,
  ) {
  }

  ngOnInit(): void {
    this.authService.user$?.subscribe((user: User) => this.loadData(user));
  }

  private loadData(user: User): void {
    if (!user) {
      return;
    }

    this.settingsFacade.loadSettings();
    this.feedsFacade.loadFeeds();
  }
}
