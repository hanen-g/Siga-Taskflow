import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { UserService, AdminUser } from '../../../services/user.service';

type ClientGender = 'FEMALE' | 'MALE' | 'OTHER' | '';

@Component({
  selector: 'app-create-client-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
    ToastModule,
    TextareaModule,
    TableModule,
    DialogModule
  ],
  templateUrl: './create-client.html',
  styleUrls: ['./create-client.css'],
  providers: [MessageService]
})
export class CreateClientPage implements OnInit {
  form = {
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '' as string,
    gender: '' as ClientGender,
    recruitmentDate: '' as string,
    company: '',
    fiscalMatricule: '',
    address: ''
  };
  createLoading = false;
  tableLoading = false;
  createError: string | null = null;

  /** Active + anciens comptes (désactivés) fusionnés, tri création récente */
  clients: AdminUser[] = [];

  private readonly statusSavingIds = new Set<number>();

  /** Ligne sélectionnée — détails dans la boîte de dialogue */
  selectedClient: AdminUser | null = null;
  detailDialogVisible = false;

  detailEditing = false;
  detailSaveLoading = false;
  detailEditError: string | null = null;
  detailEditForm = {
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '' as string,
    gender: '' as ClientGender,
    recruitmentDate: '' as string,
    company: '',
    fiscalMatricule: '',
    address: ''
  };

  constructor(
    private userService: UserService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients(): void {
    this.tableLoading = true;
    forkJoin({
      active: this.userService.getAdminUsers('', 'CLIENT', 'active'),
      former: this.userService.getAdminUsers('', 'CLIENT', 'former')
    })
      .pipe(
        map(({ active, former }) => {
          const merged = [...(active ?? []), ...(former ?? [])];
          const byId = new Map<number, AdminUser>();
          for (const u of merged) {
            byId.set(u.id, u);
          }
          return [...byId.values()].sort((a, b) =>
            String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
          );
        })
      )
      .subscribe({
        next: (list) => {
          this.clients = list;
          this.tableLoading = false;
        },
        error: () => {
          this.tableLoading = false;
          this.clients = [];
        }
      });
  }

  private resetForm(): void {
    this.form = {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      dateOfBirth: '',
      gender: '',
      recruitmentDate: '',
      company: '',
      fiscalMatricule: '',
      address: ''
    };
  }

  /** Affichage du détail lecture seule. */
  formatAddressPlain(blob: string | null | undefined): string {
    const t = (blob ?? '').trim();
    return t ? t.replace(/\s+$/, '') : '—';
  }

  genderLabel(code: string | null | undefined): string {
    switch (code) {
      case 'FEMALE':
        return 'Femme';
      case 'MALE':
        return 'Homme';
      case 'OTHER':
        return 'Autre';
      default:
        return '—';
    }
  }

  formatDate(val: string | null | undefined): string {
    if (!val) return '—';
    const d = val.includes('T') ? val.split('T')[0] : String(val).slice(0, 10);
    if (!d || d.length < 10) return '—';
    try {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    } catch {
      return val;
    }
  }

  isSavingStatus(id: number): boolean {
    return this.statusSavingIds.has(id);
  }

  openClientDetail(c: AdminUser): void {
    this.detailEditing = false;
    this.detailEditError = null;
    this.selectedClient = c;
    this.detailDialogVisible = true;
  }

  onDetailHide(): void {
    this.detailEditing = false;
    this.detailEditError = null;
    this.selectedClient = null;
  }

  startDetailEdit(): void {
    const d = this.selectedClient;
    if (!d) return;
    this.detailEditError = null;
    this.detailEditForm = {
      firstName: d.firstName ?? '',
      lastName: d.lastName ?? '',
      email: d.email ?? '',
      phoneNumber: d.phoneNumber ?? '',
      dateOfBirth: this.apiDateToInput(d.dateOfBirth),
      gender: (d.gender as ClientGender) || '',
      recruitmentDate: this.apiDateToInput(d.recruitmentDate),
      company: d.company ?? '',
      fiscalMatricule: d.fiscalMatricule ?? '',
      address: d.address ?? ''
    };
    this.detailEditing = true;
  }

  cancelDetailEdit(): void {
    this.detailEditing = false;
    this.detailEditError = null;
  }

  private apiDateToInput(api: string | null | undefined): string {
    if (!api) return '';
    const s = api.includes('T') ? String(api.split('T')[0]) : String(api).slice(0, 10);
    return s.length >= 10 ? s : '';
  }

  saveDetailProfile(): void {
    const d = this.selectedClient;
    if (!d || this.detailSaveLoading) return;

    const f = this.detailEditForm;
    this.detailEditError = null;

    if (!f.firstName?.trim() || !f.lastName?.trim() || !f.email?.trim()) {
      this.detailEditError = 'Renseignez le prénom, le nom et l’e-mail.';
      return;
    }
    if (!f.phoneNumber?.trim()) {
      this.detailEditError = 'Renseignez le numéro de téléphone.';
      return;
    }
    if (!f.dateOfBirth?.trim()) {
      this.detailEditError = 'Renseignez la date de naissance.';
      return;
    }
    if (!f.gender?.trim()) {
      this.detailEditError = 'Sélectionnez le genre.';
      return;
    }
    if (!f.recruitmentDate?.trim()) {
      this.detailEditError = 'Renseignez la date de recrutement.';
      return;
    }
    if (!f.company?.trim()) {
      this.detailEditError = 'Renseignez la société.';
      return;
    }
    if (!f.fiscalMatricule?.trim()) {
      this.detailEditError = 'Renseignez le matricule fiscal.';
      return;
    }
    if (!f.address?.trim()) {
      this.detailEditError = 'Renseignez l’adresse.';
      return;
    }

    this.detailSaveLoading = true;
    this.userService
      .updateAdminUser(d.id, {
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        email: f.email.trim().toLowerCase(),
        role: 'CLIENT',
        phoneNumber: f.phoneNumber.trim(),
        address: f.address.trim(),
        dateOfBirth: f.dateOfBirth.trim(),
        gender: f.gender.trim(),
        recruitmentDate: f.recruitmentDate.trim(),
        company: f.company.trim(),
        fiscalMatricule: f.fiscalMatricule.trim()
      })
      .subscribe({
        next: (updated) => {
          this.detailSaveLoading = false;
          const row = this.clients.find((u) => u.id === updated.id);
          if (row) {
            Object.assign(row, updated);
          }
          if (this.selectedClient?.id === updated.id) {
            Object.assign(this.selectedClient, updated);
          }
          this.detailEditing = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Profil mis à jour',
            detail: 'Les informations du client ont été enregistrées.',
            life: 2200
          });
        },
        error: (err) => {
          this.detailSaveLoading = false;
          const msg = err?.error?.message;
          this.detailEditError = typeof msg === 'string' ? msg : 'Impossible d’enregistrer le profil.';
        }
      });
  }

  clientDetailHeader(): string {
    const c = this.selectedClient;
    if (!c) {
      return 'Détails du client';
    }
    const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
    return name || 'Détails du client';
  }

  onClientStatusToggle(c: AdminUser, nextActive: boolean): void {
    const id = c.id;
    if (this.statusSavingIds.has(id) || c.active === nextActive) {
      return;
    }

    const prev = c.active;
    c.active = nextActive;
    this.statusSavingIds.add(id);
    this.userService.updateUserStatus(id, nextActive).subscribe({
      next: (updated) => {
        c.active = updated.active;
        this.statusSavingIds.delete(id);
        this.messageService.add({
          severity: 'success',
          summary: 'Statut mis à jour',
          detail: updated.active ? 'Le compte est actif.' : 'Le compte est désactivé.',
          life: 2000
        });
      },
      error: () => {
        c.active = prev;
        this.statusSavingIds.delete(id);
        this.messageService.add({
          severity: 'error',
          summary: 'Échec',
          detail: 'Impossible de modifier le statut du compte.',
          life: 3500
        });
      }
    });
  }

  submit(): void {
    this.createError = null;

    if (!this.form.firstName?.trim() || !this.form.lastName?.trim() || !this.form.email?.trim()) {
      this.createError = 'Renseignez le prénom, le nom et l’e-mail.';
      return;
    }
    if (!this.form.phoneNumber?.trim()) {
      this.createError = 'Renseignez le numéro de téléphone.';
      return;
    }
    if (!this.form.dateOfBirth?.trim()) {
      this.createError = 'Renseignez la date de naissance.';
      return;
    }
    if (!this.form.gender?.trim()) {
      this.createError = 'Sélectionnez le genre.';
      return;
    }
    if (!this.form.recruitmentDate?.trim()) {
      this.createError = 'Renseignez la date de recrutement.';
      return;
    }
    if (!this.form.company?.trim()) {
      this.createError = 'Renseignez la société.';
      return;
    }
    if (!this.form.fiscalMatricule?.trim()) {
      this.createError = 'Renseignez le matricule fiscal.';
      return;
    }
    if (!this.form.address?.trim()) {
      this.createError = 'Renseignez l’adresse.';
      return;
    }

    this.createLoading = true;
    this.userService
      .createAdminUser({
        firstName: this.form.firstName.trim(),
        lastName: this.form.lastName.trim(),
        email: this.form.email.trim().toLowerCase(),
        role: 'CLIENT',
        skillIds: [],
        phoneNumber: this.form.phoneNumber.trim(),
        address: this.form.address.trim(),
        dateOfBirth: this.form.dateOfBirth.trim(),
        active: false,
        gender: this.form.gender.trim(),
        recruitmentDate: this.form.recruitmentDate.trim(),
        company: this.form.company.trim(),
        fiscalMatricule: this.form.fiscalMatricule.trim()
      })
      .subscribe({
        next: (res) => {
          this.createLoading = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Client créé',
            detail: res?.message ?? 'Compte client enregistré.',
            life: 2000
          });
          this.resetForm();
          this.loadClients();
        },
        error: (err) => {
          this.createLoading = false;
          const msg = err?.error?.message;
          this.createError = typeof msg === 'string' ? msg : 'Impossible de créer le compte client.';
        }
      });
  }
}
