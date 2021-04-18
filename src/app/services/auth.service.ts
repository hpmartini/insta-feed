import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import firebase from 'firebase/app';
import { AngularFirestore } from '@angular/fire/firestore';
import { FIREBASE_CONSTANTS } from '../constants/firebase.constants';

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
      .catch((error) => {
        console.log(error);
        window.alert(error);
      });
  }

  private resolveResponse(user: firebase.User): Promise<void> {
    console.log(user);
    return this.firestore
      .collection(FIREBASE_CONSTANTS.users)
      .doc(user.uid)
      .set(
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified,
        },
        { merge: true }
      );
  }
}
