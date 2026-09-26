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

/**
 * Cumulative and progressive loans must not offer each other's features. See issue #186.
 *
 * Buy-down fees and capitalised income belong to the progressive engine, so a cumulative loan
 * showed two tabs that could never contain anything — an empty table the user cannot distinguish
 * from "none recorded" — and issued two guaranteed-useless requests on every loan view.
 *
 * Mocked rather than backend, so the gating runs in the fast CI project. Seeding a real
 * progressive product and a real cumulative one just to compare two tab bars would put this
 * behind a live Fineract for no extra confidence.
 */

import { test, expect, Page } from './fixtures';

const TENANT = 'default';
const USER = 'mifos';
const PASSWORD = 'password';
const HEAD_OFFICE = 'Head Office';
const BUY_DOWN_TAB = 'Buy-Down Fees';
const CAPITALIZED_TAB = 'Capitalized Income';

interface LoanOverrides {
  loanScheduleType?: { code: string; value: string };
  externalId?: string | null;
  enableBuyDownFee?: boolean;
  enableIncomeCapitalization?: boolean;
  chargedOff?: boolean;
}

function loan(overrides: LoanOverrides) {
  return {
    id: 456,
    accountNo: 'L000456',
    externalId: 'ext-456',
    clientId: 1,
    clientName: 'Jane Smith',
    loanProductName: 'Demo Product',
    principal: 5000,
    annualInterestRate: 12,
    status: { id: 300, code: 'loanStatusType.active', value: 'Active', active: true },
    currency: { code: 'USD', displaySymbol: '$' },
    summary: { principalOutstanding: 5000, totalOutstanding: 5000 },
    repaymentSchedule: { periods: [] },
    transactions: [],
    charges: [],
    ...overrides,
  };
}

/** Counts the calls the page makes, so "does not fetch" is asserted rather than assumed. */
interface Probe {
  buyDownCalls: number;
  capitalizedCalls: number;
}

async function loginWithLoan(page: Page, overrides: LoanOverrides): Promise<Probe> {
  const probe: Probe = { buyDownCalls: 0, capitalizedCalls: 0 };

  await page.route('**/config.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fineractApiUrl: '/api/v1', defaultTenant: TENANT }),
    });
  });

  await page.route('**/api/v1/authentication**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        username: USER,
        userId: 1,
        base64EncodedAuthenticationKey: 'YmFzZTY0',
        authenticated: true,
        officeId: 1,
        officeName: HEAD_OFFICE,
        roles: [{ id: 1, name: 'Super User', description: 'Super user' }],
        permissions: ['ALL_FUNCTIONS'],
      }),
    });
  });

  /*
   * Addressed by loan id, not external id. Both tabs used to fetch through
   * `/loans/external-id/{externalId}/…` and so were gated on the loan *having* an external id,
   * which is optional — on a loan without one the tab appeared and stayed permanently empty.
   * These routes deliberately do not match the external-id form, so a regression back to it
   * leaves the counters at zero and fails here.
   */
  await page.route(/\/api\/v1\/loans\/\d+\/buydown-fees/, async (route) => {
    probe.buyDownCalls += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route(/\/api\/v1\/loans\/\d+\/capitalized-incomes/, async (route) => {
    probe.capitalizedCalls += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route(/\/api\/v1\/loans\/456(\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(loan(overrides)),
    });
  });

  await page.goto('/login');
  await page.locator('#tenantId').fill(TENANT);
  await page.locator('#username').fill(USER);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL('/dashboard');

  return probe;
}

const tab = (page: Page, name: string) => page.locator('ion-segment-button', { hasText: name });

test.describe('Loan schedule type gating', () => {
  test('a cumulative loan offers neither progressive-only tab, and fetches neither', async ({
    page,
  }) => {
    const probe = await loginWithLoan(page, {
      loanScheduleType: { code: 'CUMULATIVE', value: 'Cumulative' },
    });

    await page.goto('/loans/view/456');
    // Anchor on something that is always present, so the negative assertions below are made
    // against a rendered page rather than an empty one.
    await expect(tab(page, 'Repayment Schedule')).toBeVisible();

    await expect(tab(page, BUY_DOWN_TAB)).toHaveCount(0);
    await expect(tab(page, CAPITALIZED_TAB)).toHaveCount(0);

    expect(probe.buyDownCalls).toBe(0);
    expect(probe.capitalizedCalls).toBe(0);
  });

  test('a progressive loan shows only the capabilities it actually has', async ({ page }) => {
    const probe = await loginWithLoan(page, {
      loanScheduleType: { code: 'PROGRESSIVE', value: 'Progressive' },
      enableBuyDownFee: true,
    });

    await page.goto('/loans/view/456');
    await expect(tab(page, BUY_DOWN_TAB)).toBeVisible();
    // Progressive alone is not enough — the product has to have enabled it.
    await expect(tab(page, CAPITALIZED_TAB)).toHaveCount(0);

    await expect.poll(() => probe.buyDownCalls).toBeGreaterThan(0);
    expect(probe.capitalizedCalls).toBe(0);
  });

  /*
   * External ids are optional. The fetch used to require one, so on a loan without one the tab
   * rendered and stayed empty forever with the error swallowed — indistinguishable from a loan
   * that genuinely has no buy-down fees.
   */
  test('fetches buy-down fees for a progressive loan that has no external id', async ({ page }) => {
    const probe = await loginWithLoan(page, {
      loanScheduleType: { code: 'PROGRESSIVE', value: 'Progressive' },
      enableBuyDownFee: true,
      externalId: null,
    });

    await page.goto('/loans/view/456');
    await expect(tab(page, BUY_DOWN_TAB)).toBeVisible();

    await expect
      .poll(() => probe.buyDownCalls, {
        message: 'no request was made — the fetch is still gated on the external id',
      })
      .toBeGreaterThan(0);
  });

  test('a progressive loan with both capabilities shows both', async ({ page }) => {
    await loginWithLoan(page, {
      loanScheduleType: { code: 'PROGRESSIVE', value: 'Progressive' },
      enableBuyDownFee: true,
      enableIncomeCapitalization: true,
    });

    await page.goto('/loans/view/456');
    await expect(tab(page, BUY_DOWN_TAB)).toBeVisible();
    await expect(tab(page, CAPITALIZED_TAB)).toBeVisible();

    await tab(page, CAPITALIZED_TAB).click();
    await expect(page.locator('.tab-content')).toBeVisible();
  });

  /**
   * Fineract keeps a charged-off loan `Active`, so the status badge cannot distinguish it. The
   * marker and the action swap are the only signals the officer gets. Covered here as well as in
   * the backend spec so the gating runs in the fast project.
   */
  test('a charged-off loan says so and offers the reversal instead', async ({ page }) => {
    await loginWithLoan(page, {
      loanScheduleType: { code: 'CUMULATIVE', value: 'Cumulative' },
      chargedOff: true,
    });

    await page.goto('/loans/view/456');
    await expect(page.getByTestId('loan-charged-off-chip')).toBeVisible();

    await page.getByRole('button', { name: 'Actions' }).click();
    await expect(page.getByTestId('loan-undo-charge-off-action')).toBeVisible();
    await expect(page.getByTestId('loan-charge-off-action')).toHaveCount(0);
  });

  test('a healthy loan offers charge-off and no marker', async ({ page }) => {
    await loginWithLoan(page, { loanScheduleType: { code: 'CUMULATIVE', value: 'Cumulative' } });

    await page.goto('/loans/view/456');
    await expect(page.getByTestId('loan-charged-off-chip')).toHaveCount(0);

    await page.getByRole('button', { name: 'Actions' }).click();
    await expect(page.getByTestId('loan-charge-off-action')).toBeVisible();
    await expect(page.getByTestId('loan-undo-charge-off-action')).toHaveCount(0);
  });
});
