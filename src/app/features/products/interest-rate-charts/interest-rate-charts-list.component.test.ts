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
import { InterestRateChartsListComponent } from './interest-rate-charts-list.component';
import {
  FixedDepositProductService,
  InterestRateChartService,
  RecurringDepositProductService,
} from '../../../api';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateTesting } from '../../../testing/i18n-testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DialogService } from '../../../core/services/dialog.service';

describe('InterestRateChartsListComponent', () => {
  let component: InterestRateChartsListComponent;
  let fixture: ComponentFixture<InterestRateChartsListComponent>;
  let serviceSpy: SpyObj<InterestRateChartService>;
  let fixedProductsSpy: SpyObj<FixedDepositProductService>;
  let recurringProductsSpy: SpyObj<RecurringDepositProductService>;
  let routerSpy: SpyObj<Router>;
  let dialogService: SpyObj<DialogService>;

  beforeEach(async () => {
    serviceSpy = createSpyObj(['getInterestratecharts', 'deleteInterestratechartsChartId']);
    // Charts belong to deposit products, and the platform 500s on a bare list, so the screen
    // asks each product for its own.
    fixedProductsSpy = createSpyObj(['getFixeddepositproducts']);
    recurringProductsSpy = createSpyObj(['getRecurringdepositproducts']);
    fixedProductsSpy.getFixeddepositproducts.mockReturnValue(
      of([{ id: 11, name: 'Fixed A' }]) as unknown as ReturnType<
        FixedDepositProductService['getFixeddepositproducts']
      >,
    );
    recurringProductsSpy.getRecurringdepositproducts.mockReturnValue(
      of([]) as unknown as ReturnType<
        RecurringDepositProductService['getRecurringdepositproducts']
      >,
    );
    routerSpy = createSpyObj(['navigate']);
    dialogService = createSpyObj(['confirm']);
    dialogService.confirm.mockResolvedValue(true);
    serviceSpy.getInterestratecharts.mockReturnValue(
      of([
        { id: 1, fromDate: '01 January 2024', savingsProductName: 'Prod A' },
      ]) as unknown as ReturnType<InterestRateChartService['getInterestratecharts']>,
    );

    await TestBed.configureTestingModule({
      imports: [InterestRateChartsListComponent],
      providers: [
        ...provideTranslateTesting(),
        { provide: InterestRateChartService, useValue: serviceSpy },
        { provide: FixedDepositProductService, useValue: fixedProductsSpy },
        { provide: RecurringDepositProductService, useValue: recurringProductsSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DialogService, useValue: dialogService },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InterestRateChartsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load charts on init, naming the product each time', async () => {
    await fixture.whenStable();

    expect(component).toBeTruthy();
    // The defect this replaces: a bare call, which the platform answers with a 500.
    expect(serviceSpy.getInterestratecharts).toHaveBeenCalledWith(11);
    expect(serviceSpy.getInterestratecharts).not.toHaveBeenCalledWith(undefined);
    expect(component.charts()).toHaveLength(1);
  });

  it('keeps the rest of the table when one product refuses', async () => {
    serviceSpy.getInterestratecharts.mockReturnValue(
      throwError(() => new Error('boom')) as unknown as ReturnType<
        InterestRateChartService['getInterestratecharts']
      >,
    );

    component.load();
    await fixture.whenStable();

    expect(component.charts()).toEqual([]);
    expect(component.loadFailed()).toBe(false);
  });

  it('should navigate to a chart slabs view', () => {
    component.onSlabs({ id: 7 });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/interest-rate-charts', 7, 'slabs']);
  });

  it('should navigate to edit with the chart id', () => {
    component.onEdit({ id: 3 });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/products/interest-rate-charts/edit', 3]);
  });

  it('should delete after confirmation and reload', async () => {
    await fixture.whenStable();

    serviceSpy.deleteInterestratechartsChartId.mockReturnValue(
      of({}) as unknown as ReturnType<InterestRateChartService['deleteInterestratechartsChartId']>,
    );

    component.onDelete({ id: 5 });

    await fixture.whenStable();

    expect(serviceSpy.deleteInterestratechartsChartId).toHaveBeenCalledWith(5);
    // Once on init, once after the delete — one call per product each time.
    expect(serviceSpy.getInterestratecharts).toHaveBeenCalledTimes(2);
  });

  it('should not delete when cancelled', async () => {
    dialogService.confirm.mockResolvedValue(false);
    component.onDelete({ id: 5 });
    await fixture.whenStable();
    expect(serviceSpy.deleteInterestratechartsChartId).not.toHaveBeenCalled();
  });
});
