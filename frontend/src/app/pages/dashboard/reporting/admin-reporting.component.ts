import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import type { AdminDashboard } from '../../../models/reporting.model';
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
  selector: 'app-admin-reporting',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ChartModule,
    TableModule,
    TagModule,
    AppLoaderComponent
  ],
  templateUrl: './admin-reporting.component.html',
  styleUrls: ['./admin-reporting.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminReportingPage implements OnInit {
  loading = true;
  data?: AdminDashboard;

  usersRoleDonut = donutData();
  projectsStatusDonut = donutData();
  tasksPerProject = barData();
  pmBar = barData();
  platStatus = donutData();
  trend = lineData();
  opts = defaultChartOptions;
  barOpts = barChartOptions;
  lineOpts = lineChartOptions;

  constructor(
    private reporting: ReportingService,
    private messages: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.reporting
      .admin()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (d) => {
          this.data = d;
          this.usersRoleDonut = donutData(d.usersByRole);
          this.projectsStatusDonut = donutData(d.projectsByStatus);
          this.tasksPerProject = barData(d.tasksPerProject, 'Tasks');
          this.pmBar = barData(d.projectManagerTeamCompletionPercent, 'Team %');
          this.platStatus = donutData(d.platformStatusDistribution);
          this.trend = lineData(d.platformCompletionTrend30Days, 'Completions');
          this.cdr.markForCheck();
        },
        error: () => {
          this.messages.add({
            severity: 'error',
            summary: 'Could not load admin reporting',
            detail: 'Administrator session required.'
          });
          this.cdr.markForCheck();
        }
      });
  }

  riskSeverity(label: string): 'success' | 'danger' {
    return label === 'AT_RISK' ? 'danger' : 'success';
  }

  accountSeverity(s: string): 'success' | 'danger' | 'secondary' {
    if (s === 'ACTIVE') return 'success';
    if (s === 'DISABLED') return 'danger';
    return 'secondary';
  }
}
