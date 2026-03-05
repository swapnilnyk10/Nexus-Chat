import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

export interface AuthUser {
  token: string;
  username: string;
  avatarColor: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  // Current logged-in user, loaded from localStorage on startup
  currentUser: AuthUser | null = JSON.parse(localStorage.getItem('chat_user') || 'null');

  constructor(private http: HttpClient, private router: Router) {}

  get token(): string | null {
    return this.currentUser?.token ?? null;
  }

  get isLoggedIn(): boolean {
    return !!this.currentUser;
  }

  login(username: string, password: string) {
    return this.http.post<AuthUser>('/api/auth/login', { username, password });
  }

  register(username: string, password: string) {
    return this.http.post<AuthUser>('/api/auth/register', { username, password });
  }

  saveUser(user: AuthUser): void {
    this.currentUser = user;
    localStorage.setItem('chat_user', JSON.stringify(user));
  }

  logout(): void {
    this.currentUser = null;
    localStorage.removeItem('chat_user');
    this.router.navigate(['/login']);
  }
}
