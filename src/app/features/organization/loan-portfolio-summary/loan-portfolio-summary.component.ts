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

import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonDatetime,
  IonDatetimeButton,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';

import { I18N, TranslatePipe } from '../../../core/adapters';
import { NotificationService } from '../../../core/services/notification.service';
import {
  FINERACT_DATE_FORMAT,
  FINERACT_LOCALE,
  formatDateToFineract,
  toIsoDate,
} from '../../../core/utils/date-formatter';
import { AdHocSearchQueryData, LoanProductData, OfficeData, SearchAPIService } from '../../../api';
import { ColumnDef, DataTableComponent, HelpIconComponent } from '../../../shared';
import { createPickersReady } from '../../../shared/utils/pickers-ready';

/** The four amount-comparison shapes the platform's search endpoint understands. */
type ComparisonCondition = 'between' | '<=' | '>=' | '<' | '>' | '=';

interface PortfolioFilters {
  loanStatus: string[];
  loanProducts: number[];
  offices: number[];
  loanDateOption: string;
  includeOutStandingAmountPercentage: boolean;
  outStandingAmountPercentageCondition: ComparisonCondition;
  minOutStandingAmountPercentage: number | null;
  maxOutStandingAmountPercentage: number | null;
  outStandingAmountPercentage: number | null;
  includeOutstandingAmount: boolean;
  outstandingAmountCondition: ComparisonCondition;
  minOutstandingAmount: number | null;
  maxOutstandingAmount: number | null;
  outstandingAmount: number | null;
}

function defaultFilters(): PortfolioFilters {
  return {
    loanStatus: [],
    loanProducts: [],
    offices: [],
    loanDateOption: 'approvalDate',
    includeOutStandingAmountPercentage: false,
    outStandingAmountPercentageCondition: 'between',
    minOutStandingAmountPercentage: null,
    maxOutStandingAmountPercentage: null,
    outStandingAmountPercentage: null,
    includeOutstandingAmount: false,
    outstandingAmountCondition: 'between',
    minOutstandingAmount: null,
    maxOutstandingAmount: null,
    outstandingAmount: null,
  };
}

/**
 * The advance-search endpoint's own request model omits several fields it actually reads
 * (`entities`, `loanStatus`, `loanProducts`, `offices`, and the `between`-condition min/max
 * pairs) — its generated shape only covers the single-value comparison case. The payload is
 * built as a plain record and sent past that incomplete type, mirroring the bypass already used
 * elsewhere in this codebase for other under-specified generated models.
 */
function buildSearchPayload(filters: PortfolioFilters, fromDate: string, toDate: string) {
  const payload: Record<string, unknown> = {
    entities: ['loans'],
    loanStatus: filters.loanStatus,
    loanProducts: filters.loanProducts,
    offices: filters.offices,
    loanDateOption: filters.loanDateOption,
    loanFromDate: formatDateToFineract(fromDate),
    loanToDate: formatDateToFineract(toDate),
    dateFormat: FINERACT_DATE_FORMAT,
    locale: FINERACT_LOCALE,
    includeOutStandingAmountPercentage: filters.includeOutStandingAmountPercentage,
    includeOutstandingAmount: filters.includeOutstandingAmount,
  };

  if (filters.includeOutStandingAmountPercentage) {
    payload['outStandingAmountPercentageCondition'] = filters.outStandingAmountPercentageCondition;
    if (filters.outStandingAmountPercentageCondition === 'between') {
      payload['minOutStandingAmountPercentage'] = filters.minOutStandingAmountPercentage;
      payload['maxOutStandingAmountPercentage'] = filters.maxOutStandingAmountPercentage;
    } else {
      payload['outStandingAmountPercentage'] = filters.outStandingAmountPercentage;
    }
  }

  if (filters.includeOutstandingAmount) {
    payload['outstandingAmountCondition'] = filters.outstandingAmountCondition;
    if (filters.outstandingAmountCondition === 'between') {
      payload['minOutstandingAmount'] = filters.minOutstandingAmount;
      payload['maxOutstandingAmount'] = filters.maxOutstandingAmount;
    } else {
      payload['outstandingAmount'] = filters.outstandingAmount;
    }
  }

  return payload;
}

@Component({
  selector: 'app-loan-portfolio-summary',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    HelpIconComponent,
    DataTableComponent,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCheckbox,
    IonDatetime,
    IonDatetimeButton,
    IonInput,
    IonItem,
    IonLabel,
    IonModal,
    IonSelect,
    IonSelectOption,
    IonSpinner,
  ],
  template: `
    <div class="form-container">
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            {{ 'ORGANIZATION.LOAN_PORTFOLIO_SUMMARY' | appTranslate }}
            <app-help-icon helpTextKey="HELP.LOAN_PORTFOLIO_SUMMARY_DESC" />
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          @if (!results()) {
            <form #filtersForm="ngForm" (ngSubmit)="onSearch()" class="filters-form">
              <div class="form-grid">
                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'ORGANIZATION.LOAN_STATUS' | appTranslate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'ORGANIZATION.LOAN_STATUS' | appTranslate"
                    interface="popover"
                    multiple
                    name="loanStatus"
                    [(ngModel)]="filters.loanStatus"
                  >
                    <ion-select-option value="all">{{
                      'COMMON.ALL' | appTranslate
                    }}</ion-select-option>
                    <ion-select-option value="active">{{
                      'COMMON.ACTIVE' | appTranslate
                    }}</ion-select-option>
                    <ion-select-option value="closed">{{
                      'ORGANIZATION.LOAN_STATUS_CLOSED' | appTranslate
                    }}</ion-select-option>
                    <ion-select-option value="overpaid">{{
                      'ORGANIZATION.LOAN_STATUS_OVERPAID' | appTranslate
                    }}</ion-select-option>
                    <ion-select-option value="writeoff">{{
                      'ORGANIZATION.LOAN_STATUS_WRITTEN_OFF' | appTranslate
                    }}</ion-select-option>
                  </ion-select>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'ORGANIZATION.LOAN_PRODUCTS' | appTranslate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'ORGANIZATION.LOAN_PRODUCTS' | appTranslate"
                    interface="popover"
                    multiple
                    name="loanProducts"
                    [(ngModel)]="filters.loanProducts"
                  >
                    @for (product of loanProducts(); track product.id) {
                      <ion-select-option [value]="product.id">{{ product.name }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{ 'COMMON.OFFICE' | appTranslate }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'COMMON.OFFICE' | appTranslate"
                    interface="popover"
                    multiple
                    name="offices"
                    [(ngModel)]="filters.offices"
                  >
                    @for (office of offices(); track office.id) {
                      <ion-select-option [value]="office.id">{{ office.name }}</ion-select-option>
                    }
                  </ion-select>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'ORGANIZATION.LOAN_DATE_OPTION' | appTranslate
                  }}</ion-label>
                  <ion-select
                    [attr.aria-label]="'ORGANIZATION.LOAN_DATE_OPTION' | appTranslate"
                    interface="popover"
                    name="loanDateOption"
                    [(ngModel)]="filters.loanDateOption"
                    required
                  >
                    <ion-select-option value="approvalDate">{{
                      'ORGANIZATION.APPROVAL_DATE' | appTranslate
                    }}</ion-select-option>
                    <ion-select-option value="createdDate">{{
                      'ORGANIZATION.CREATION_DATE' | appTranslate
                    }}</ion-select-option>
                    <ion-select-option value="disbursalDate">{{
                      'LOANS.DISBURSEMENT_DATE' | appTranslate
                    }}</ion-select-option>
                  </ion-select>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'ORGANIZATION.FROM_DATE' | appTranslate
                  }}</ion-label>
                  @if (pickersReady()) {
                    <ion-datetime-button datetime="fromDate-picker" />
                  }
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="fromDate-picker"
                        data-testid="fromDate-picker"
                        presentation="date"
                        name="loanFromDate"
                        [ngModel]="fromDate()"
                        (ngModelChange)="fromDate.set($event)"
                        required
                      />
                    </ng-template>
                  </ion-modal>
                </ion-item>

                <ion-item fill="outline">
                  <ion-label position="stacked">{{
                    'ORGANIZATION.TO_DATE' | appTranslate
                  }}</ion-label>
                  @if (pickersReady()) {
                    <ion-datetime-button datetime="toDate-picker" />
                  }
                  <ion-modal [keepContentsMounted]="true">
                    <ng-template>
                      <ion-datetime
                        id="toDate-picker"
                        data-testid="toDate-picker"
                        presentation="date"
                        name="loanToDate"
                        [ngModel]="toDate()"
                        (ngModelChange)="toDate.set($event)"
                        required
                      />
                    </ng-template>
                  </ion-modal>
                </ion-item>
              </div>

              <ion-item lines="none" class="checkbox-item">
                <ion-checkbox
                  [attr.aria-label]="'ORGANIZATION.OUTSTANDING_PERCENTAGE' | appTranslate"
                  name="includeOutStandingAmountPercentage"
                  [(ngModel)]="filters.includeOutStandingAmountPercentage"
                >
                  {{ 'ORGANIZATION.OUTSTANDING_PERCENTAGE' | appTranslate }}
                </ion-checkbox>
              </ion-item>

              @if (filters.includeOutStandingAmountPercentage) {
                <div class="form-grid">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'ORGANIZATION.COMPARISON_CONDITION' | appTranslate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'ORGANIZATION.COMPARISON_CONDITION' | appTranslate"
                      interface="popover"
                      name="outStandingAmountPercentageCondition"
                      [(ngModel)]="filters.outStandingAmountPercentageCondition"
                      required
                    >
                      @for (condition of comparisonConditions; track condition) {
                        <ion-select-option [value]="condition">{{ condition }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>

                  @if (filters.outStandingAmountPercentageCondition === 'between') {
                    <ion-item fill="outline">
                      <ion-label position="stacked">{{
                        'ORGANIZATION.MINIMUM_VALUE' | appTranslate
                      }}</ion-label>
                      <ion-input
                        [attr.aria-label]="'ORGANIZATION.MINIMUM_VALUE' | appTranslate"
                        type="number"
                        name="minOutStandingAmountPercentage"
                        [(ngModel)]="filters.minOutStandingAmountPercentage"
                        required
                      />
                    </ion-item>
                    <ion-item fill="outline">
                      <ion-label position="stacked">{{
                        'ORGANIZATION.MAXIMUM_VALUE' | appTranslate
                      }}</ion-label>
                      <ion-input
                        [attr.aria-label]="'ORGANIZATION.MAXIMUM_VALUE' | appTranslate"
                        type="number"
                        name="maxOutStandingAmountPercentage"
                        [(ngModel)]="filters.maxOutStandingAmountPercentage"
                        required
                      />
                    </ion-item>
                  } @else {
                    <ion-item fill="outline">
                      <ion-label position="stacked">{{
                        'ORGANIZATION.COMPARISON_VALUE' | appTranslate
                      }}</ion-label>
                      <ion-input
                        [attr.aria-label]="'ORGANIZATION.COMPARISON_VALUE' | appTranslate"
                        type="number"
                        name="outStandingAmountPercentage"
                        [(ngModel)]="filters.outStandingAmountPercentage"
                        required
                      />
                    </ion-item>
                  }
                </div>
              }

              <ion-item lines="none" class="checkbox-item">
                <ion-checkbox
                  [attr.aria-label]="'ORGANIZATION.OUTSTANDING_AMOUNT' | appTranslate"
                  name="includeOutstandingAmount"
                  [(ngModel)]="filters.includeOutstandingAmount"
                >
                  {{ 'ORGANIZATION.OUTSTANDING_AMOUNT' | appTranslate }}
                </ion-checkbox>
              </ion-item>

              @if (filters.includeOutstandingAmount) {
                <div class="form-grid">
                  <ion-item fill="outline">
                    <ion-label position="stacked">{{
                      'ORGANIZATION.COMPARISON_CONDITION' | appTranslate
                    }}</ion-label>
                    <ion-select
                      [attr.aria-label]="'ORGANIZATION.COMPARISON_CONDITION' | appTranslate"
                      interface="popover"
                      name="outstandingAmountCondition"
                      [(ngModel)]="filters.outstandingAmountCondition"
                      required
                    >
                      @for (condition of comparisonConditions; track condition) {
                        <ion-select-option [value]="condition">{{ condition }}</ion-select-option>
                      }
                    </ion-select>
                  </ion-item>

                  @if (filters.outstandingAmountCondition === 'between') {
                    <ion-item fill="outline">
                      <ion-label position="stacked">{{
                        'ORGANIZATION.MINIMUM_VALUE' | appTranslate
                      }}</ion-label>
                      <ion-input
                        [attr.aria-label]="'ORGANIZATION.MINIMUM_VALUE' | appTranslate"
                        type="number"
                        name="minOutstandingAmount"
                        [(ngModel)]="filters.minOutstandingAmount"
                        required
                      />
                    </ion-item>
                    <ion-item fill="outline">
                      <ion-label position="stacked">{{
                        'ORGANIZATION.MAXIMUM_VALUE' | appTranslate
                      }}</ion-label>
                      <ion-input
                        [attr.aria-label]="'ORGANIZATION.MAXIMUM_VALUE' | appTranslate"
                        type="number"
                        name="maxOutstandingAmount"
                        [(ngModel)]="filters.maxOutstandingAmount"
                        required
                      />
                    </ion-item>
                  } @else {
                    <ion-item fill="outline">
                      <ion-label position="stacked">{{
                        'ORGANIZATION.COMPARISON_VALUE' | appTranslate
                      }}</ion-label>
                      <ion-input
                        [attr.aria-label]="'ORGANIZATION.COMPARISON_VALUE' | appTranslate"
                        type="number"
                        name="outstandingAmount"
                        [(ngModel)]="filters.outstandingAmount"
                        required
                      />
                    </ion-item>
                  }
                </div>
              }

              <div class="form-actions">
                <ion-button
                  color="primary"
                  type="submit"
                  [disabled]="filtersForm.invalid || isSearching()"
                >
                  @if (isSearching()) {
                    <ion-spinner name="crescent" />
                    {{ 'COMMON.LOADING' | appTranslate }}
                  } @else {
                    {{ 'COMMON.SEARCH' | appTranslate }}
                  }
                </ion-button>
              </div>
            </form>
          } @else {
            <div class="results-toolbar">
              <ion-button fill="outline" (click)="onEditFilters()">
                {{ 'ORGANIZATION.EDIT_PARAMETERS' | appTranslate }}
              </ion-button>
            </div>
            <app-data-table
              [columns]="resultColumns"
              [data]="results() ?? []"
              [totalRecords]="(results() ?? []).length"
              [localLogic]="true"
              [showSearch]="false"
            />
          }
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [
    `
      .form-container {
        padding: 24px;
        max-width: 1000px;
        margin: 0 auto;
      }
      .filters-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
        gap: 16px;
      }
      .checkbox-item {
        --padding-start: 0;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
      }
      .results-toolbar {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 12px;
      }
    `,
  ],
})
export class LoanPortfolioSummaryComponent implements OnInit {
  /** See `createPickersReady` — the date buttons must not outrun their pickers. */
  readonly pickersReady = createPickersReady();

  private readonly searchService = inject(SearchAPIService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18N);

  readonly comparisonConditions: ComparisonCondition[] = ['between', '<=', '>=', '<', '>', '='];

  readonly offices = signal<OfficeData[]>([]);
  readonly loanProducts = signal<LoanProductData[]>([]);
  readonly isSearching = signal(false);
  readonly results = signal<AdHocSearchQueryData[] | null>(null);

  readonly fromDate = signal(toIsoDate(new Date()));
  readonly toDate = signal(toIsoDate(new Date()));

  filters: PortfolioFilters = defaultFilters();

  readonly resultColumns: ColumnDef[] = [
    { key: 'officeName', label: 'COMMON.OFFICE' },
    { key: 'loanProductName', label: 'LOANS.PRODUCT' },
    { key: 'count', label: 'ORGANIZATION.COUNT' },
    { key: 'loanOutStanding', label: 'ORGANIZATION.OUTSTANDING_AMOUNT' },
    { key: 'percentage', label: 'ORGANIZATION.PERCENTAGE' },
  ];

  ngOnInit(): void {
    this.searchService.getSearchTemplate().subscribe({
      next: (template) => {
        this.offices.set(template.offices ?? []);
        this.loanProducts.set(template.loanProducts ?? []);
      },
      error: () => {
        this.notifications.error(this.i18n.translate('ORGANIZATION.TEMPLATE_LOAD_FAILED'));
      },
    });
  }

  onSearch(): void {
    this.isSearching.set(true);
    const payload = buildSearchPayload(this.filters, this.fromDate(), this.toDate());

    this.searchService.postSearchAdvance(payload as never).subscribe({
      next: (data) => {
        this.isSearching.set(false);
        this.results.set(data ?? []);
      },
      error: () => {
        this.isSearching.set(false);
        this.notifications.error(this.i18n.translate('ORGANIZATION.SEARCH_FAILED'));
      },
    });
  }

  onEditFilters(): void {
    this.results.set(null);
  }
}
