import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import type { ProjectManagerDashboard } from '../../../models/reporting.model';
import { ReportingService } from '../../../services/reporting.service';
import {
  barChartOptions,
  barData,
  defaultChartOptions,
  donutData,
  lineChartOptions,
  lineData
} from './reporting-charts';
import { AppLoaderComponent } from '../../../layout/app-loader';

@Component({
  selector: 'app-pm-reporting',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ChartModule,
    ProgressBarModule,
    TableModule,
    TagModule,
    AppLoaderComponent
  ],
  templateUrl: './pm-reporting.component.html',
  styleUrls: ['./pm-reporting.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PmReportingPage implements OnInit {
  loading = true;
  data?: ProjectManagerDashboard;

  donut = donutData();
  projectBar = barData();
  collabBar = barData(undefined, 'Done tasks');
  line = lineData();
  opts = defaultChartOptions;
  barOpts = barChartOptions;
  lineOpts = lineChartOptions;

  constructor(
    private readonly reporting: ReportingService,
    private readonly messages: MessageService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.reporting
      .projectManager()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (d) => {
          this.data = d;
          this.donut = donutData(d.overallStatusDistribution);
          this.projectBar = barData(d.projectProgressPercent, 'Progress %');
          this.collabBar = barData(d.collaboratorCompletionCounts, 'Completions');
          this.line = lineData(d.completionTrendLast30Days, 'Completed/day');
          this.cdr.markForCheck();
        },
        error: () => {
          this.messages.add({
            severity: 'error',
            summary: 'Could not load PM reporting',
            detail: 'Check session and backend availability.'
          });
          this.cdr.markForCheck();
        }
      });
  }

  riskSeverity(label: string): 'success' | 'danger' {
    return label === 'AT_RISK' ? 'danger' : 'success';
  }
}
