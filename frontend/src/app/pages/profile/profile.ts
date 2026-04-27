import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { map, switchMap, takeUntil } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { AvatarModule } from 'primeng/avatar';
import { MessageService } from 'primeng/api';
import { ApiService, UpdateProfileRequest, UserProfile } from '../../services/api';
import { FileAccessService } from '../../services/file-access.service';
import { SkillService } from '../../services/skill.service';
import { Skill } from '../../models/skill.model';
import { MultiSelectModule } from 'primeng/multiselect';

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
    MultiSelectModule,
  ],
  providers: [MessageService],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css'],
})
export class ProfilePage implements OnInit, OnDestroy {
  // ── Private internals ──────────────────────────────────────────────────────

  private readonly MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

  private readonly destroy$ = new Subject<void>();
  private readonly picturePath$ = new Subject<string | null>();

  /** Object URL created from the last successfully fetched server-relative path. */
  private profilePictureObjectUrl = '';
  /** Server path that `profilePictureObjectUrl` was created from, if any. */
  private profilePictureBlobSourcePath = '';

  // ── Public state ───────────────────────────────────────────────────────────

  /** Bound in the template; empty string falls back to initials avatar. */
  profilePictureDisplaySrc = '';

  user: UserProfile | null = null;
  firstName = '';
  lastName = '';
  email = '';
  profilePicture = '';
  profilePicturePreview = '';
  selectedProfileImage: File | null = null;

  // ── UI flags ───────────────────────────────────────────────────────────────

  isEditingProfile = false;
  isChangingPassword = false;
  showPasswordDialog = false;
  isLoading = false;

  // ── Form fields ────────────────────────────────────────────────────────────

  currentPassword = '';
  password = '';
  confirmPassword = '';

  allSkills: Skill[] = [];
  selectedSkillIds: number[] = [];
  skillsUiLoading = false;
  skillsSaving = false;

  // ── Constructor ────────────────────────────────────────────────────────────

  constructor(
    private api: ApiService,
    private messageService: MessageService,
    private fileAccessService: FileAccessService,
    private skillService: SkillService,
  ) {
    this.picturePath$
      .pipe(
        switchMap((path) => {
          if (!path || this.isDirectUrl(path)) return [];
          if (this.profilePictureObjectUrl && this.profilePictureBlobSourcePath === path) return [];
          this.revokePictureObjectUrl();
          return this.fileAccessService.fetchFileBlob(path).pipe(
            map((blob) => ({ path, blob })),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: ({ path, blob }) => {
          this.profilePictureObjectUrl = URL.createObjectURL(blob);
          this.profilePictureBlobSourcePath = path;
          this.profilePictureDisplaySrc = this.profilePictureObjectUrl;
        },
        error: () => {
          this.profilePictureDisplaySrc = '';
        },
      });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadProfile();
  }

  get canEditSkills(): boolean {
    const r = this.user?.role;
    return r === 'PROJECT_MANAGER' || r === 'COLLABORATOR' || r === 'ADMIN';
  }

  saveMySkills(): void {
    this.skillsSaving = true;
    this.skillService.putMySkills(this.selectedSkillIds).subscribe({
      next: () => {
        this.skillsSaving = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Saved',
          detail: 'Your skills were updated.',
          life: 3000,
        });
      },
      error: (err) => {
        this.skillsSaving = false;
        this.showError(err.error?.message ?? err.error?.error ?? 'Could not update skills.');
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.revokePictureObjectUrl();
    this.revokePicturePreviewBlob();
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  loadProfile(): void {
    this.applyProfile(this.readCachedUser());

    this.api.getProfile().subscribe({
      next: (profile) => {
        this.applyProfile(profile);
        localStorage.setItem('user', JSON.stringify(profile));
      },
      error: (err) => {
        console.error('Failed to load profile:', err);
        this.showError('Unable to load profile information.');
      },
    });
  }

  // ── Mode transitions ───────────────────────────────────────────────────────

  enterEditMode(): void {
    this.resetModes();
    this.isEditingProfile = true;
  }

  enterChangePasswordMode(): void {
    this.resetModes();
    this.isChangingPassword = true;
    this.showPasswordDialog = true;
  }

  cancelEditing(): void {
    this.resetModes();
    this.loadProfile();
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  onProfilePictureChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (file.size > this.MAX_PROFILE_IMAGE_BYTES) {
      input.value = '';
      this.selectedProfileImage = null;
      this.revokePicturePreviewBlob();
      this.syncPictureDisplay();
      this.messageService.add({
        severity: 'warn',
        summary: 'Image too large',
        detail: 'Please choose an image smaller than 5 MB.',
        life: 3000,
      });
      return;
    }

    this.selectedProfileImage = file;
    this.revokePicturePreviewBlob();
    this.profilePicturePreview = URL.createObjectURL(file);
    this.syncPictureDisplay();
  }

  // ── Save actions ───────────────────────────────────────────────────────────

  saveProfile(): void {
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
          map((res) => ({ ...basePayload, profilePicture: res.fileUrl })),
        )
      : of(basePayload);

    this.isLoading = true;

    upload$.subscribe({
      next: (payload) => this.updateProfile(payload, 'Profile updated successfully.'),
      error: (err) => {
        console.error('Profile picture upload error:', err);
        this.isLoading = false;
        this.showError(err.error?.error ?? err.error?.message ?? 'Failed to upload profile picture.');
      },
    });
  }

  savePassword(): void {
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

  // ── Getters ────────────────────────────────────────────────────────────────

  getInitials(): string {
    const first = this.firstName?.charAt(0).toUpperCase() ?? '';
    const last = this.lastName?.charAt(0).toUpperCase() ?? '';
    if (first || last) return `${first}${last}`;
    return this.email ? this.email.split('@')[0].substring(0, 2).toUpperCase() : 'U';
  }

  get roleLabel(): string {
    return this.user?.role?.replaceAll('_', ' ') ?? 'Member';
  }

  private loadSkillsUi(): void {
    if (!this.canEditSkills) {
      this.allSkills = [];
      this.selectedSkillIds = [];
      return;
    }
    this.skillsUiLoading = true;
    this.skillService.getAllSkills().subscribe({
      next: (all) => {
        this.allSkills = all;
        this.skillService.getMySkills().subscribe({
          next: (mine) => {
            this.selectedSkillIds = mine.map((s) => s.id);
            this.skillsUiLoading = false;
          },
          error: () => {
            this.skillsUiLoading = false;
            this.showError('Could not load your skills.');
          },
        });
      },
      error: () => {
        this.skillsUiLoading = false;
        this.showError('Could not load the skills catalog.');
      },
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private readCachedUser(): UserProfile | null {
    try {
      const raw = localStorage.getItem('user');
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
      return null;
    }
  }

  private applyProfile(profile: UserProfile | null): void {
    if (!profile) return;
    this.user = profile;
    this.loadSkillsUi();
    this.firstName = profile.firstName;
    this.lastName = profile.lastName;
    this.email = profile.email;
    this.selectedProfileImage = null;
    this.revokePictureObjectUrl();
    this.revokePicturePreviewBlob();
    this.profilePicture = profile.profilePicture ?? '';
    this.syncPictureDisplay();
  }

  private updateProfile(payload: UpdateProfileRequest, successMessage: string): void {
    this.isLoading = true;

    this.api.updateProfile(payload).subscribe({
      next: (profile) => {
        this.applyProfile(profile);
        localStorage.setItem('user', JSON.stringify(profile));
        this.isLoading = false;
        this.isEditingProfile = false;
        this.isChangingPassword = false;
        this.clearPasswordFields();
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: successMessage, life: 3000 });
      },
      error: (err) => {
        console.error('Profile update error:', err);
        this.isLoading = false;
        this.showError(err.error?.message ?? 'Failed to update profile.');
      },
    });
  }

  private syncPictureDisplay(): void {
    const picture = this.profilePicturePreview || this.profilePicture;

    if (!picture) {
      this.revokePictureObjectUrl();
      this.profilePictureDisplaySrc = '';
      return;
    }

    if (this.isDirectUrl(picture)) {
      this.revokePictureObjectUrl();
      this.profilePictureDisplaySrc = picture;
      return;
    }

    if (this.profilePictureObjectUrl && this.profilePictureBlobSourcePath === picture) {
      this.profilePictureDisplaySrc = this.profilePictureObjectUrl;
      return;
    }

    this.profilePictureDisplaySrc = '';
    this.picturePath$.next(picture);
  }

  private isDirectUrl(url: string): boolean {
    return /^(blob:|data:|https?:)/.test(url);
  }

  private resetModes(): void {
    this.isEditingProfile = false;
    this.isChangingPassword = false;
    this.showPasswordDialog = false;
    this.clearPasswordFields();
  }

  private clearPasswordFields(): void {
    this.currentPassword = '';
    this.password = '';
    this.confirmPassword = '';
  }

  private showError(detail: string): void {
    this.messageService.add({ severity: 'error', summary: 'Error', detail, life: 3000 });
  }

  private revokePicturePreviewBlob(): void {
    if (this.profilePicturePreview.startsWith('blob:')) {
      URL.revokeObjectURL(this.profilePicturePreview);
    }
    this.profilePicturePreview = '';
  }

  private revokePictureObjectUrl(): void {
    if (!this.profilePictureObjectUrl) return;
    URL.revokeObjectURL(this.profilePictureObjectUrl);
    this.profilePictureObjectUrl = '';
    this.profilePictureBlobSourcePath = '';
  }
}