import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import firebase from 'firebase/app';
import {
  AngularFirestore,
  AngularFirestoreDocument,
} from '@angular/fire/firestore';
import { FIREBASE_CONSTANTS } from '../constants/firebase.constants';
import { User } from '../model/user';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  user$: Observable<User>;

  constructor(
    private readonly fireAuth: AngularFireAuth,
    private readonly firestore: AngularFirestore,
    private readonly router: Router
  ) {
    this.user$ = this.fireAuth.authState.pipe(
      switchMap((user: User) => this.getUserObservable(user))
    );
  }

  private getUserObservable(user: User): Observable<any> {
    return user
      ? this.firestore.doc<User>(this.buildUserPath(user.uid)).valueChanges()
      : of(null);
  }

  async loginWithGoogle(): Promise<void> {
    const provider = new firebase.auth.GoogleAuthProvider();
    const credentials = await this.fireAuth.signInWithPopup(provider);
    return this.updateUserData(credentials.user);
  }

  async logOut(): Promise<boolean> {
    console.log('logging out');
    await this.fireAuth.signOut();
    localStorage.removeItem('user');
    return this.router.navigate(['/']);
  }

  private updateUserData({
    uid,
    email,
    displayName,
    emailVerified,
    photoURL,
  }: User): Promise<void> {
    const userRef: AngularFirestoreDocument<User> = this.firestore.doc(
      this.buildUserPath(uid)
    );
    const data: User = {
      uid,
      email,
      displayName,
      emailVerified,
      photoURL,
    };
    return userRef.set(data, { merge: true });
  }

  private buildUserPath(uid): string {
    return FIREBASE_CONSTANTS.users.concat('/', uid);
  }
}
