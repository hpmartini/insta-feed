import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import firebase from 'firebase/app';
import { AngularFirestore } from '@angular/fire/firestore';
import { FIREBASE_CONSTANTS } from '../constants/firebase.constants';
import { User } from '../model/user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(
    private readonly fireAuth: AngularFireAuth,
    private readonly firestore: AngularFirestore
  ) {}

  loginWithGoogle(): Promise<void> {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
    provider.setCustomParameters({
      login_hint: 'user@example.com',
    });
    return this.fireAuth
      .signInWithPopup(provider)
      .then((response) => this.resolveResponse(response.user))
      .catch((error) => window.alert(error));
  }

  private resolveResponse({
    uid,
    email,
    displayName,
    emailVerified,
    photoURL,
  }: User): Promise<void> {
    return this.firestore.collection(FIREBASE_CONSTANTS.users).doc(uid).set(
      {
        uid,
        email,
        displayName,
        photoURL,
        emailVerified,
      },
      { merge: true }
    );
  }
}
