import { Component } from '@angular/core';
import { Feed } from '../../model/feed';
import { AuthService } from '../../services/auth.service';
import {
  LoginRegisterDialogComponent,
  LoginRegisterType,
} from '../../components/login-register-dialog/login-register-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { NgIf, AsyncPipe } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.sass'],
    standalone: true,
    imports: [
        NgIf,
        MatButton,
        RouterLink,
        MatIcon,
        AsyncPipe,
    ],
})
export class HomeComponent {
  public navEntries: Feed[] = [
    {
      name: 'Süddeutsche',
      url: 'rss.sueddeutsche.de/rss/Topthemen',
      icon: 'panorama_photosphere',
    },
  ];

  constructor(
    public readonly authService: AuthService,
    private readonly dialog: MatDialog
  ) {}

  openLoginDialog(): void {
    this.dialog.open(LoginRegisterDialogComponent, {
      width: '423px',
      data: { type: LoginRegisterType.login },
      autoFocus: false,
    });
  }
}
