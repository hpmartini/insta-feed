import { Injectable, inject } from '@angular/core';
import { Auth, authState, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser } from '@angular/fire/auth';
import { Firestore, doc, docData, setDoc } from '@angular/fire/firestore';
import { FIREBASE_CONSTANTS } from '../constants/firebase.constants';
import { User } from '../model/user';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  user$: Observable<User | null>;
  private readonly auth: Auth = inject(Auth);
  private readonly firestore: Firestore = inject(Firestore);

  constructor(private readonly router: Router) {
    this.user$ = authState(this.auth).pipe(
      switchMap((user: FirebaseUser | null) => this.getUserObservable(user as User))
    );
  }

  private getUserObservable(user: User | null): Observable<User | null> {
    if (user) {
      const userDocRef = doc(this.firestore, this.buildUserPath(user.uid));
      return docData(userDocRef, { idField: 'uid' }) as Observable<User | null>;
    } else {
      return of(null);
    }
  }

  async loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    const credentials = await signInWithPopup(this.auth, provider);
    return this.updateUserData(credentials.user as User);
  }

  async logOut(): Promise<boolean> {
    console.log('logging out');
    await signOut(this.auth);
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
    const userDocRef = doc(this.firestore, this.buildUserPath(uid));
    const data: User = {
      uid,
      email,
      displayName,
      emailVerified,
      photoURL,
    };
    return setDoc(userDocRef, data, { merge: true });
  }

  private buildUserPath(uid: string): string {
    return FIREBASE_CONSTANTS.users.concat('/', uid);
  }
}
