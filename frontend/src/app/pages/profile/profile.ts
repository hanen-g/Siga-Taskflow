import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiService, UpdateProfileRequest, UserProfile } from '../../services/api';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CardModule,
    DialogModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css'],
})
export class ProfilePage implements OnInit {
  user: UserProfile | null = null;
  firstName = '';
  lastName = '';
  email = '';

  // UI state
  isEditingProfile = false;
  isChangingPassword = false;
  showPasswordDialog = false;

  currentPassword = '';
  password = '';
  confirmPassword = '';
  isLoading = false;

  constructor(private api: ApiService, private messageService: MessageService) {}

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        this.user = JSON.parse(storedUser);
        if (this.user) {
          this.firstName = this.user.firstName;
          this.lastName = this.user.lastName;
          this.email = this.user.email;
        }
      } catch (e) {
        console.error('Failed to parse stored user:', e);
      }
    }

    this.api.getProfile().subscribe({
      next: (profile) => {
        this.user = profile;
        this.firstName = profile.firstName;
        this.lastName = profile.lastName;
        this.email = profile.email;
        localStorage.setItem('user', JSON.stringify(profile));
      },
      error: (err) => {
        console.error('Failed to load profile:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Unable to load profile information.',
          life: 3000,
        });
      },
    });
  }

  enterEditMode() {
    this.isEditingProfile = true;
    this.isChangingPassword = false;
    this.password = '';
    this.confirmPassword = '';
  }

  enterChangePasswordMode() {
    this.isChangingPassword = true;
    this.isEditingProfile = false;
    this.showPasswordDialog = true;
    this.currentPassword = '';
    this.password = '';
    this.confirmPassword = '';
  }

  cancelEditing() {
    this.isEditingProfile = false;
    this.isChangingPassword = false;
    this.showPasswordDialog = false;
    this.loadProfile();
  }

  saveProfile() {
    if (!this.firstName || !this.lastName) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation',
        detail: 'First name and last name are required.',
        life: 3000,
      });
      return;
    }

    this.updateProfile({ firstName: this.firstName, lastName: this.lastName }, 'Profile updated successfully.');
  }

  savePassword() {
    if (!this.currentPassword || !this.password || this.password !== this.confirmPassword) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation',
        detail: 'Current password, new password, and confirmation are required and must match.',
        life: 3000,
      });
      return;
    }

    this.updateProfile(
      { currentPassword: this.currentPassword, password: this.password },
      'Password updated successfully.',
    );
  }

  private updateProfile(payload: UpdateProfileRequest, successMessage: string) {
    this.isLoading = true;

    this.api.updateProfile(payload).subscribe({
      next: (profile) => {
        this.user = profile;
        localStorage.setItem('user', JSON.stringify(profile));
        this.isLoading = false;
        this.isEditingProfile = false;
        this.isChangingPassword = false;
        this.password = '';
        this.confirmPassword = '';
        this.messageService.add({
          severity: 'success',
          summary: 'Saved',
          detail: successMessage,
          life: 3000,
        });
      },
      error: (err) => {
        console.error('Profile update error:', err);
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to update profile.',
          life: 3000,
        });
      },
    });
  }
}

