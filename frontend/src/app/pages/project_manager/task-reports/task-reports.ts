import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { AppLoaderComponent } from '../../../layout/app-loader';
import { TaskReport } from '../../../models/task-report.model';
import { TaskReportService } from '../../../services/task-report.service';

@Component({
  standalone: true,
  selector: 'app-task-reports-page',
  templateUrl: './task-reports.html',
  styleUrls: ['./task-reports.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonModule, ToastModule, AppLoaderComponent],
  providers: [MessageService]
})
export class TaskReportsPage implements OnInit {
  reports: TaskReport[] = [];
  isLoading = true;
  errorMessage = '';
  resolvingIds = new Set<number>();

  constructor(
    private taskReportService: TaskReportService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.taskReportService.getManagerReports().subscribe({
      next: (reports) => {
        this.reports = reports;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load task reports', err);
        this.reports = [];
        this.errorMessage = 'Could not load task reports. Please try again.';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  resolveReport(report: TaskReport): void {
    if (!report.id || this.resolvingIds.has(report.id)) {
      return;
    }

    this.resolvingIds.add(report.id);
    this.cdr.markForCheck();

    this.taskReportService.resolveReport(report.id).subscribe({
      next: () => {
        this.reports = this.reports.filter((item) => item.id !== report.id);
        this.resolvingIds.delete(report.id!);
        this.messageService.add({
          severity: 'success',
          summary: 'Report fixed',
          detail: 'The collaborator has been notified.'
        });
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to resolve task report', err);
        this.resolvingIds.delete(report.id!);
        this.messageService.add({
          severity: 'error',
          summary: 'Update failed',
          detail: err?.error?.message ?? err?.error?.error ?? 'Could not discard this report.'
        });
        this.cdr.markForCheck();
      }
    });
  }

  isResolving(report: TaskReport): boolean {
    return !!report.id && this.resolvingIds.has(report.id);
  }

  formatDate(value?: string): string {
    if (!value) {
      return '-';
    }
    return new Date(value).toLocaleString();
  }

  trackByReport(_index: number, report: TaskReport): number | undefined {
    return report.id;
  }
}
