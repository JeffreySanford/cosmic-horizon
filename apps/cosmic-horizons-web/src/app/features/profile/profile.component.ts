import { Component, OnInit, inject, DestroyRef, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { finalize, timeout } from 'rxjs/operators';
import { ProfileApiService, ProfileModel } from './profile-api.service';
import { AuthSessionService } from '../../services/auth-session.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: false,
})
export class ProfileComponent implements OnInit {
  profile: ProfileModel | null = null;
  loading = false;
  error: string | null = null;
  editing = false;
  saving = false;
  isOwner = false;
  saveMessage: string | null = null;

  // Retry/fallback state for stuck loads
  loadTimedOut = false;
  private _loadTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private currentUsername: string | null = null;
  private retryCount = 0;
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly profileApi = inject(ProfileApiService);
  private readonly authSessionService = inject(AuthSessionService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly editForm = this.formBuilder.group({
    display_name: ['', [Validators.required, Validators.maxLength(255)]],
    bio: ['', [Validators.maxLength(1000)]],
    avatar_url: ['', [Validators.maxLength(512)]],
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const routeUsername = params.get('username')?.trim() ?? '';
      const sessionUsername = this.authSessionService.getUser()?.username?.trim() ?? '';

      // DEBUG: trace route/session resolution
      console.debug('[ProfileComponent] paramMap', { routeUsername, sessionUsername });

      if (!routeUsername && sessionUsername) {
        this.router.navigate(['/profile', sessionUsername], { replaceUrl: true });
        return;
      }

      const resolvedUsername = routeUsername || sessionUsername;
      if (!resolvedUsername) {
        this.error = 'Unable to resolve a profile username for this session.';
        this.loading = false;
        return;
      }

      this.isOwner = sessionUsername.length > 0 && resolvedUsername === sessionUsername;
      this.loadProfile(resolvedUsername);
    });
  }

  loadProfile(username: string): void {
    // DEBUG: entry
    console.debug('[ProfileComponent] loadProfile.start', { username });

    // clear any previous timeout and state
    if (this._loadTimeoutId) {
      clearTimeout(this._loadTimeoutId);
      this._loadTimeoutId = null;
    }
    this.loadTimedOut = false;
    this.currentUsername = username;

    this.loading = true;
    this.error = null;
    this.saveMessage = null;

    // If load is still in progress after 8s, surface a retry option to the user
    this._loadTimeoutId = setTimeout(() => {
      this.loadTimedOut = true;
      console.debug('[ProfileComponent] loadProfile.timedOut', { username });
    }, 8000);

    this.profileApi
      .getProfile(username)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        timeout(10000),
        finalize(() => {
          // clear timeout and mark loading finished
          if (this._loadTimeoutId) {
            clearTimeout(this._loadTimeoutId);
            this._loadTimeoutId = null;
          }
          this.loading = false;
          // force change detection so template sees the updated `loading` flag immediately
          try {
            this.cdr.detectChanges();
          } catch {
            /* ignore */
          }
          console.debug('[ProfileComponent] loadProfile.finalize', { username, loading: this.loading });
        }),
      )
      .subscribe({
        next: (profile) => {
          console.debug('[ProfileComponent] getProfile.next', profile);
          this.profile = profile;
          this.editing = false;
          this.loadTimedOut = false;
          this.retryCount = 0;
          try {
            this.editForm.reset({
              display_name: profile.user.display_name || profile.user.username || '',
              bio: profile.user.bio || '',
              avatar_url: profile.user.avatar_url || '',
            });
          } catch (e) {
            console.error('[ProfileComponent] editForm.reset failed', e, profile);
            throw e;
          }

          // ensure the view updates immediately (defensive for hydration/change-detection edge cases)
          try {
            this.cdr.detectChanges();
          } catch {
            /* ignore */
          }
        },
        error: (err) => {
          console.error('[ProfileComponent] getProfile.error', err);
          this.error = err.error?.message || 'Failed to load profile.';
        },
      });
  }

  retryProfile(): void {
    if (!this.currentUsername) return;

    // Prevent infinite retry storms
    if (this.retryCount >= 3) {
      console.warn('[ProfileComponent] retryProfile: max retries reached');
      return;
    }

    this.retryCount += 1;
    console.debug('[ProfileComponent] retryProfile', { username: this.currentUsername, attempt: this.retryCount });
    this.loadProfile(this.currentUsername);
  }

  startEdit(): void {
    if (!this.profile || !this.isOwner) {
      return;
    }

    this.saveMessage = null;
    this.editing = true;
  }

  cancelEdit(): void {
    if (!this.profile) {
      return;
    }

    this.editing = false;
    this.editForm.reset({
      display_name: this.profile.user.display_name || this.profile.user.username || '',
      bio: this.profile.user.bio || '',
      avatar_url: this.profile.user.avatar_url || '',
    });
  }

  saveProfile(): void {
    if (!this.profile || !this.isOwner) {
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.saveMessage = null;

    const payload = {
      display_name: (this.editForm.value.display_name ?? '').trim(),
      bio: (this.editForm.value.bio ?? '').trim(),
      avatar_url: (this.editForm.value.avatar_url ?? '').trim(),
    };

    this.profileApi
      .updateProfile({
        display_name: payload.display_name || undefined,
        bio: payload.bio || undefined,
        avatar_url: payload.avatar_url || undefined,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.saving = false;
        }),
      )
      .subscribe({
        next: () => {
          if (!this.profile) {
            return;
          }

          this.profile = {
            ...this.profile,
            user: {
              ...this.profile.user,
              display_name: payload.display_name || this.profile.user.display_name,
              bio: payload.bio || undefined,
              avatar_url: payload.avatar_url || undefined,
            },
          };
          this.editing = false;
          this.saveMessage = 'Profile updated.';
        },
        error: (err) => {
          this.saveMessage = err.error?.message || 'Failed to update profile.';
        },
      });
  }
}
