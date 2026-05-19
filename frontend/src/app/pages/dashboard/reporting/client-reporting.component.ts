import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { PanelModule } from 'primeng/panel';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageService } from 'primeng/api';
import type { ClientDashboard } from '../../../models/reporting.model';
import { ReportingService } from '../../../services/reporting.service';
import { barChartOptions, barData, defaultChartOptions, donutData } from './reporting-charts';
import { AppLoaderComponent } from '../../../layout/app-loader';

@Component({
  selector: 'app-client-reporting',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ChartModule,
    PanelModule,
    TagModule,
    ProgressBarModule,
    AppLoaderComponent
  ],
  templateUrl: './client-reporting.component.html',
  styleUrls: ['./client-reporting.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientReportingPage implements OnInit {
  loading = true;
  data?: ClientDashboard;

  bar = barData();
  donut = donutData();
  barOpts = barChartOptions;
  opts = defaultChartOptions;

  constructor(
    private reporting: ReportingService,
    private messages: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.reporting
      .client()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (d) => {
          this.data = d;
          this.bar = barData(d.projectProgressPercent, 'Progress');
          this.donut = donutData(d.combinedStatusDistribution);
          this.cdr.markForCheck();
        },
        error: () => {
          this.messages.add({
            severity: 'error',
            summary: 'Reporting unavailable',
            detail: 'Client session required.'
          });
          this.cdr.markForCheck();
        }
      });
  }

  riskSeverity(label: string): 'success' | 'danger' {
    return label === 'AT_RISK' ? 'danger' : 'success';
  }

  severityFor(kind: string): 'success' | 'info' | 'warn' | 'secondary' {
    switch (kind) {
      case 'COMPLETED':
        return 'success';
      case 'REVIEW':
        return 'info';
      case 'MILESTONE':
        return 'warn';
      default:
        return 'secondary';
    }
  }
}
