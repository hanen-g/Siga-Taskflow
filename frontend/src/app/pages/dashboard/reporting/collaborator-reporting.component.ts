import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import type { CollaboratorDashboard } from '../../../models/reporting.model';
import { ReportingService } from '../../../services/reporting.service';
import { barChartOptions, barData, defaultChartOptions, donutData } from './reporting-charts';
import { AppLoaderComponent } from '../../../layout/app-loader';

@Component({
  selector: 'app-collaborator-reporting',
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
  templateUrl: './collaborator-reporting.component.html',
  styleUrls: ['./collaborator-reporting.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollaboratorReportingPage implements OnInit {
  loading = true;
  data?: CollaboratorDashboard;

  donut: ReturnType<typeof donutData> = donutData();
  bar: ReturnType<typeof barData> = barData();
  chartOptions = defaultChartOptions;
  barOpts = barChartOptions;

  constructor(
    private readonly reporting: ReportingService,
    private readonly messages: MessageService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.reporting
      .collaborator()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (d) => {
          this.data = d;
          this.donut = donutData(d.statusDistribution);
          this.bar = barData(d.tasksPerProject, 'Tasks');
          this.cdr.markForCheck();
        },
        error: () => {
          this.messages.add({
            severity: 'error',
            summary: 'Could not load reporting',
            detail: 'Verify you are signed in as a collaborator and the API is reachable.'
          });
          this.cdr.markForCheck();
        }
      });
  }
}
