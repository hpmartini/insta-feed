import { Component, OnInit } from '@angular/core';
import { FeedsService } from '../../+state/feeds/feeds.service';
import { SettingsFacade } from '../../+state/settings/settings.facade';
import { MatCard, MatCardHeader, MatCardTitle, MatCardContent } from '@angular/material/card';
import { MatFormField, MatLabel, MatHint } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatSlider } from '@angular/material/slider';
import { MatButton } from '@angular/material/button';
import { NgIf } from '@angular/common';
import { SpinnerComponent } from '../../components/spinner/spinner.component';

@Component({
    selector: 'app-settings',
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.sass'],
    standalone: true,
    imports: [
        MatCard,
        MatCardHeader,
        MatCardTitle,
        MatCardContent,
        MatFormField,
        MatLabel,
        MatInput,
        ReactiveFormsModule,
        FormsModule,
        MatHint,
        MatSlider,
        MatButton,
        NgIf,
        SpinnerComponent,
    ],
})
export class SettingsComponent implements OnInit {
  public speed = 30;
  public isSaving = false;

  constructor(
    private readonly feedService: FeedsService,
    private readonly settingsFacade: SettingsFacade
  ) {}

  ngOnInit(): void {
    this.settingsFacade.settings$.subscribe(
      (settings) => (this.speed = settings?.speed ?? this.speed)
    );

    this.feedService.savingSettings.subscribe(
      (isSaving) => (this.isSaving = isSaving)
    );
  }

  save(): void {
    if (this.isSaving) {
      return;
    }
    this.settingsFacade.saveSettings({ speed: this.speed });
  }
}
