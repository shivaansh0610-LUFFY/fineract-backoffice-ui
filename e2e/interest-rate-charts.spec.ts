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
 * The interest rate charts list never asks the platform a question it refuses.
 *
 * `productId` is documented as optional on `GET /interestratecharts`, and the platform answers a
 * bare call with a 500. The screen used to make exactly that call, so it errored on every visit:
 * the table showed "No records found." while a toast displayed the raw request URL and status.
 *
 * Only a real backend shows this. The spec is written against the requests the page makes rather
 * than against rows, because the fixture may legitimately hold no charts — an empty table is the
 * correct outcome, a 500 is not.
 *
 *   npm run test:e2e:local -- e2e/interest-rate-charts.spec.ts
 */

import { test, expect } from './fixtures';
import { login } from './utils/fineract-login';

test.use({ video: 'on', trace: 'on' });

test('lists charts without a server error', async ({ page }) => {
  await login(page);

  const chartCalls: { url: string; status: number }[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/interestratecharts')) {
      chartCalls.push({ url: response.url(), status: response.status() });
    }
  });

  await page.goto('/products/interest-rate-charts', { waitUntil: 'networkidle' });

  const failed = chartCalls.filter((call) => call.status >= 400);
  expect(failed, `chart requests failed: ${JSON.stringify(failed)}`).toEqual([]);

  // Every call must name a product; a bare one is the 500 this spec exists to prevent.
  const bare = chartCalls.filter((call) => !new URL(call.url).searchParams.has('productId'));
  expect(bare, `requests sent without productId: ${JSON.stringify(bare)}`).toEqual([]);

  // The load-failure state belongs to a real failure, not to "this tenant has no charts".
  await expect(page.getByText('This list could not be loaded.')).toBeHidden();
});
