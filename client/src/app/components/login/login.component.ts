import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {

  mode: 'login' | 'register' = 'login';

  username = '';
  password = '';
  error    = '';
  loading  = false;

  constructor(private auth: AuthService, private router: Router) {}

  submit(): void {
    if (!this.username || !this.password) {
      this.error = 'Please enter a username and password';
      return;
    }

    this.loading = true;
    this.error   = '';

    const request = this.mode === 'login'
      ? this.auth.login(this.username, this.password)
      : this.auth.register(this.username, this.password);

    request.subscribe({
      next: (user) => {
        this.auth.saveUser(user);
        this.router.navigate(['/chat']);
      },
      error: (err) => {
        this.error   = err.error?.error || 'Something went wrong';
        this.loading = false;
      }
    });
  }

  switchMode(m: 'login' | 'register'): void {
    this.mode     = m;
    this.error    = '';
    this.username = '';
    this.password = '';
  }
}
