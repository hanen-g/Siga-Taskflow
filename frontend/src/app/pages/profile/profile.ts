import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { AvatarModule } from 'primeng/avatar';
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
    AvatarModule,
  ],
  providers: [MessageService],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css'],
})
export class ProfilePage implements OnInit {
  private readonly maxProfileImageSizeBytes = 10 * 1024 * 1024;
  user: UserProfile | null = null;
  firstName = '';
  lastName = '';
  email = '';
  profilePicture = '';
  profilePicturePreview = '';
  selectedProfileImage: File | null = null;

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
          this.profilePicture = this.user.profilePicture || '';
          this.profilePicturePreview = '';
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
        this.profilePicture = profile.profilePicture || '';
        this.profilePicturePreview = '';
        this.selectedProfileImage = null;
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

  onProfilePictureChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    if (file.size > this.maxProfileImageSizeBytes) {
      input.value = '';
      this.selectedProfileImage = null;
      this.profilePicturePreview = '';
      this.messageService.add({
        severity: 'warn',
        summary: 'Image Too Large',
        detail: 'Please choose an image smaller than 10 MB.',
        life: 3000,
      });
      return;
    }

    this.selectedProfileImage = file;
    this.profilePicturePreview = URL.createObjectURL(this.selectedProfileImage);
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

    const basePayload: UpdateProfileRequest = {
      firstName: this.firstName,
      lastName: this.lastName,
      profilePicture: this.profilePicture,
    };

    const upload$ = this.selectedProfileImage
      ? this.api.uploadFile(this.selectedProfileImage).pipe(
          switchMap((response) =>
            of({
              ...basePayload,
              profilePicture: response.url,
            }),
          ),
        )
      : of(basePayload);

    this.isLoading = true;

    upload$.subscribe({
      next: (payload) => {
        this.updateProfile(payload, 'Profile updated successfully.');
      },
      error: (err) => {
        console.error('Profile picture upload error:', err);
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.error || err.error?.message || 'Failed to upload profile picture.',
          life: 3000,
        });
      },
    });
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
        this.firstName = profile.firstName;
        this.lastName = profile.lastName;
        this.email = profile.email;
        this.profilePicture = profile.profilePicture || '';
        this.profilePicturePreview = '';
        this.selectedProfileImage = null;
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

  getProfilePictureSrc(): string {
    const picture = this.profilePicturePreview || this.profilePicture;

    if (!picture) {
      return '';
    }

    if (picture.startsWith('blob:') || picture.startsWith('data:') || picture.startsWith('http')) {
      return picture;
    }

    // Use the API base URL without the /api suffix for file URLs
    const baseUrl = this.api.getBaseUrl().replace('/api', '');
    return `${baseUrl}${picture}`;
  }

  getInitials(): string {
    if (this.firstName || this.lastName) {
      const firstInitial = this.firstName ? this.firstName.charAt(0).toUpperCase() : '';
      const lastInitial = this.lastName ? this.lastName.charAt(0).toUpperCase() : '';
      return `${firstInitial}${lastInitial}` || this.email.split('@')[0].substring(0, 2).toUpperCase();
    }

    if (this.email) {
      return this.email.split('@')[0].substring(0, 2).toUpperCase();
    }

    return '';
  }
}

