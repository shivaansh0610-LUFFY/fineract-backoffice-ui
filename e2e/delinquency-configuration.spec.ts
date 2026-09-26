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
 * Delinquency ranges and buckets can be created and edited, not only deleted.
 *
 * The management screen rendered "Create Range", "Create Bucket" and a per-row edit on each
 * table, all routing to `ranges/…` and `buckets/…` paths that had no route and no component:
 * every one of the four landed on "Page not found". Delete worked, so the screen could only ever
 * remove delinquency configuration, with no way back.
 *
 * Driven against a real backend because the interesting half is the round trip — a range needs
 * `locale` alongside its day counts, and a bucket's selectable ranges come from
 * `GET /delinquency/buckets/template`, which nothing had ever called.
 *
 *   npm run test:e2e:local -- e2e/delinquency-configuration.spec.ts
 */

import { test, expect } from './fixtures';
import { login, uniqueSuffix } from './utils/fineract-login';
import { selectTab } from './utils/ionic-locators';

test.use({ video: 'on', trace: 'on' });

test('creates a delinquency range, then edits it', async ({ page }) => {
  await login(page);
  await page.goto('/system/delinquency', { waitUntil: 'networkidle' });

  // Rendered by routerLink, so the accessible role is link rather than button.
  await page.getByRole('link', { name: 'Create Range' }).click();
  // The assertion that would have caught the original defect: this used to be "Page not found".
  await expect(page).toHaveURL(/\/system\/delinquency\/ranges\/create$/);
  await expect(page.getByTestId('delinquency-range-classification')).toBeVisible();

  const classification = `E2ERange${uniqueSuffix()}`;
  await page.getByTestId('delinquency-range-classification').fill(classification);
  await page.getByTestId('delinquency-range-min').fill('1');
  await page.getByTestId('delinquency-range-max').fill('30');

  const created = page.waitForResponse(
    (response) =>
      response.url().includes('/delinquency/ranges') && response.request().method() === 'POST',
  );
  await page.getByTestId('delinquency-range-save').click();
  expect(
    (await created).status(),
    'create refused — the day counts need a locale alongside them',
  ).toBe(200);

  await expect(page).toHaveURL(/\/system\/delinquency$/);
  await expect(page.getByText(classification)).toBeVisible();

  // Edit the row that was just created, which is the other half of the dead link.
  const row = page.locator('tr', { hasText: classification });
  await row.getByRole('link', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/\/system\/delinquency\/ranges\/edit\/\d+$/);
  await expect(page.getByTestId('delinquency-range-classification')).toHaveValue(classification);

  await page.getByTestId('delinquency-range-max').fill('45');
  const updated = page.waitForResponse(
    (response) =>
      response.url().includes('/delinquency/ranges/') && response.request().method() === 'PUT',
  );
  await page.getByTestId('delinquency-range-save').click();
  expect((await updated).status()).toBe(200);
});

test('creates a delinquency bucket from the ranges the template offers', async ({ page }) => {
  await login(page);

  // A bucket needs at least one range, so make one rather than depending on fixture order.
  await page.goto('/system/delinquency/ranges/create', { waitUntil: 'networkidle' });
  const classification = `E2EBucketRange${uniqueSuffix()}`;
  await page.getByTestId('delinquency-range-classification').fill(classification);
  await page.getByTestId('delinquency-range-min').fill('1');
  await page.getByTestId('delinquency-range-max').fill('15');
  await page.getByTestId('delinquency-range-save').click();
  await expect(page).toHaveURL(/\/system\/delinquency$/);

  // Buckets live behind their own tab; the screen opens on Ranges.
  await selectTab(page, 'Delinquency Buckets');
  await page.getByRole('link', { name: 'Create Bucket' }).click();
  await expect(page).toHaveURL(/\/system\/delinquency\/buckets\/create$/);

  // Populated from GET /delinquency/buckets/template — an endpoint nothing called before.
  await expect(page.getByTestId('delinquency-bucket-no-ranges')).toBeHidden();
  const rangeCheckbox = page.locator('[data-testid^="delinquency-bucket-range-"]').first();
  await expect(rangeCheckbox).toBeVisible();

  const name = `E2EBucket${uniqueSuffix()}`;
  await page.getByTestId('delinquency-bucket-name').fill(name);
  await rangeCheckbox.check();

  // The type is required and defaults to the template's first option, so the form is valid
  // without the operator having to discover an empty select behind a disabled Save.
  await expect(page.getByTestId('delinquency-bucket-type')).not.toHaveValue('');

  const created = page.waitForResponse(
    (response) =>
      response.url().includes('/delinquency/buckets') && response.request().method() === 'POST',
  );
  await page.getByTestId('delinquency-bucket-save').click();
  expect(
    (await created).status(),
    `bucket create refused: ${await (await created).text().catch(() => '<unreadable>')}`,
  ).toBe(200);

  await expect(page).toHaveURL(/\/system\/delinquency$/);
});
