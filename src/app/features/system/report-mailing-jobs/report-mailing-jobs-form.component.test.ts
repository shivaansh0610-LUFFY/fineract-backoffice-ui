/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { createSpyObj, SpyObj } from '../../../testing/mocks';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReportMailingJobsFormComponent } from './report-mailing-jobs-form.component';
import { ReportMailingJobsService, ReportsService } from '../../../api';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('ReportMailingJobsFormComponent', () => {
  let component: ReportMailingJobsFormComponent;
  let fixture: ComponentFixture<ReportMailingJobsFormComponent>;
  let serviceSpy: SpyObj<ReportMailingJobsService>;
  let reportsServiceSpy: SpyObj<ReportsService>;
  let routerSpy: SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = createSpyObj([
      'getReportmailingjobsEntityId',
      'postReportmailingjobs',
      'putReportmailingjobsEntityId',
      'getReportmailingjobsTemplate',
    ]);
    reportsServiceSpy = createSpyObj(['getReports']);
    routerSpy = createSpyObj(['navigate']);

    // Both are fetched in ngOnInit: the report picker replaced a free-text numeric id, and the
    // attachment format is one of the parameters the platform requires.
    reportsServiceSpy.getReports.mockReturnValue(
      of([{ id: 1, reportName: 'Client Listing' }]) as unknown as ReturnType<
        ReportsService['getReports']
      >,
    );
    serviceSpy.getReportmailingjobsTemplate.mockReturnValue(
      of({
        emailAttachmentFileFormatOptions: [{ id: 1, code: 'XLS', value: 'xls' }],
      }) as unknown as ReturnType<ReportMailingJobsService['getReportmailingjobsTemplate']>,
    );

    await TestBed.configureTestingModule({
      imports: [ReportMailingJobsFormComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: ReportMailingJobsService, useValue: serviceSpy },
        { provide: ReportsService, useValue: reportsServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportMailingJobsFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers the reports and attachment formats it fetched rather than a numeric id box', () => {
    expect(component.reports()).toHaveLength(1);
    expect(component.attachmentFormats()).toHaveLength(1);
    // Defaulting it means the operator is not left with a required field they never saw.
    expect(component.attachmentFormatId).toBe(1);
  });

  /*
   * The create was refused on every attempt because the payload was missing five parameters the
   * platform requires. `stretchyReportId` is locale-sensitive, so a payload carrying it without a
   * `locale` is rejected outright; `dateFormat` cannot be the `dd MMMM yyyy` used elsewhere in
   * this codebase, because with a time appended the platform throws rather than parsing it.
   */
  it('should post on create and navigate to the list', () => {
    serviceSpy.postReportmailingjobs.mockReturnValue(
      of({}) as unknown as ReturnType<ReportMailingJobsService['postReportmailingjobs']>,
    );
    component.job.set({
      name: 'New',
      emailRecipients: 'a@b.c',
      emailSubject: 'Sub',
      emailMessage: 'Body',
      recurrence: 'FREQ=DAILY;INTERVAL=1',
      stretchyReportId: 1,
      isActive: true,
    });
    component.startDateTimeLocal = '2026-10-01T09:30';

    component.onSubmit();

    expect(serviceSpy.postReportmailingjobs).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New',
        emailMessage: 'Body',
        emailAttachmentFileFormatId: 1,
        recurrence: 'FREQ=DAILY;INTERVAL=1',
        startDateTime: '2026-10-01 09:30:00',
        locale: 'en',
        dateFormat: 'yyyy-MM-dd HH:mm:ss',
      }),
    );
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/system/report-mailing-jobs']);
  });
});
