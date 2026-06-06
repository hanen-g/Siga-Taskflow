import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, of } from 'rxjs';
import { map, switchMap, takeUntil } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
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
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
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
  phoneNumber = '';
  address = '';
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

  /** Skills assigned to this user (PM / collaborator only; admins and clients never see this block). */
  mySkills: Skill[] = [];
  skillsUiLoading = false;

  // ── Constructor ────────────────────────────────────────────────────────────

  constructor(
    private readonly api: ApiService,
    private readonly messageService: MessageService,
    private readonly fileAccessService: FileAccessService,
    private readonly skillService: SkillService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.picturePath$
      .pipe(
        switchMap((path) => {
          if (!path || this.isDirectUrl(path)) return EMPTY;
          if (this.profilePictureObjectUrl && this.profilePictureBlobSourcePath === path) return EMPTY;
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
          this.cdr.detectChanges();
        },
        error: () => {
          this.profilePictureDisplaySrc = '';
          this.cdr.detectChanges();
        },
      });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadProfile();
  }

  /** Skills are shown for PM and collaborator; admins and clients do not see skills on this page. */
  get showSkillsSection(): boolean {
    const r = this.user?.role;
    return r === 'PROJECT_MANAGER' || r === 'COLLABORATOR';
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
        this.cdr.detectChanges();
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

    if (this.phoneNumber.length > 40) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation',
        detail: 'Phone number must be at most 40 characters.',
        life: 3000,
      });
      return;
    }
    if (this.address.length > 1024) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation',
        detail: 'Address must be at most 1024 characters.',
        life: 3000,
      });
      return;
    }

    const basePayload: UpdateProfileRequest = {
      firstName: this.firstName,
      lastName: this.lastName,
      profilePicture: this.profilePicture,
      phoneNumber: this.phoneNumber.trim(),
      address: this.address.trim(),
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

  get memberSinceStatusLine(): string {
    const formatted = this.formatProfileCreatedDate(this.user?.createdAt);
    if (!formatted) return 'Member since';
    return `Member since : ${formatted}`;
  }

  /** Parses `yyyy-MM-dd` as a local calendar date for display (avoids UTC off-by-one). */
  private formatProfileCreatedDate(isoDate: string | null | undefined): string {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return '';
    const [y, m, d] = isoDate.split('-').map((x) => Number.parseInt(x, 10));
    if (!y || !m || !d) return '';
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(y, m - 1, d));
  }

  private loadSkillsUi(): void {
    if (!this.showSkillsSection) {
      this.mySkills = [];
      return;
    }
    this.skillsUiLoading = true;
    this.skillService.getMySkills().subscribe({
      next: (mine) => {
        this.mySkills = mine ?? [];
        this.skillsUiLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.skillsUiLoading = false;
        this.showError('Could not load your skills.');
        this.cdr.detectChanges();
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
    this.phoneNumber = profile.phoneNumber ?? '';
    this.address = profile.address ?? '';
    this.selectedProfileImage = null;
    this.revokePictureObjectUrl();
    this.revokePicturePreviewBlob();
    this.profilePicture = profile.profilePicture ?? '';
    this.syncPictureDisplay();
    this.cdr.detectChanges();
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