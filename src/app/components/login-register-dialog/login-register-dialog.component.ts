import { Component, Inject } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export enum LoginRegisterType {
  login,
  register,
}

export interface LoginRegisterDialogData {
  type: LoginRegisterType;
}

@Component({
  selector: 'app-login-register-dialog',
  templateUrl: './login-register-dialog.component.html',
  styleUrls: ['./login-register-dialog.component.sass'],
})
export class LoginRegisterDialogComponent {
  public loginRegisterForm = new FormGroup({
    email: new FormControl(''),
    password: new FormControl(''),
  });

  constructor(
    public dialogRef: MatDialogRef<LoginRegisterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LoginRegisterDialogData
  ) {}

  getLoginRegisterTypeName(): string {
    return this.data.type === LoginRegisterType.login ? 'Log in' : 'Register';
  }
}
