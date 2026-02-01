import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {

  email = '';
  password = '';
  message = '';

  constructor(private api: ApiService) {}
  
login() {
  this.api.login(this.email, this.password).subscribe({
    next: (res) => {
      localStorage.setItem('token', res.token);
      this.message = 'Login successful';
      console.log('JWT stored:', res.token);
    },
    error: () => {
      this.message = 'Invalid credentials';
    }
  });
}


}
