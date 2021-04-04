import { Component, OnInit } from '@angular/core';
import { SettingsFacade } from './+state/settings/settings.facade';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass'],
})
export class AppComponent implements OnInit {
  title = 'insta-feed';

  constructor(private readonly settingsFacade: SettingsFacade) {}

  ngOnInit(): void {
    this.settingsFacade.loadSettings();
  }
}
