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
 * The report-mailing job form sends a payload the platform accepts, at both viewports.
 *
 * The form used to send four of the parameters `POST /reportmailingjobs` requires and none of the
 * other four. Asking the platform for the minimum names them: `startDateTime`, `emailMessage`,
 * `emailAttachmentFileFormatId` and `dateFormat`, plus the `locale` that `stretchyReportId`
 * cannot travel without. So every save had failed validation.
 *
 * ## Why these cases assert on the request rather than on a 200
 *
 * With a complete payload this Fineract still refuses the create, and the reason is its own:
 *
 *     null value in column "number_of_runs" of relation "m_report_mailing_job"
 *     violates not-null constraint
 *
 * `numberOfRuns` is not a request parameter — sending it is rejected as unsupported — so no
 * client can satisfy that column. Verified against apache/fineract develop @ 2026-08-15 with
 * curl, independently of this UI. Asserting a 200 here would make these cases fail for a defect
 * they do not own, and asserting the 500 would freeze a platform bug into the suite.
 *
 * What is ours, and what these cases hold: every mandatory parameter is present and correctly
 * shaped, and the platform's answer is no longer a *validation* failure. Tighten to a 200 once
 * the platform can give one.
 *
 *   npm run test:e2e:local -- e2e/report-mailing-job.spec.ts
 */

import { test, expect, Page } from './fixtures';
import { login, uniqueSuffix } from './utils/fineract-login';

const NARROW = { width: 320, height: 844 };
const WIDE = { width: 1280, height: 900 };

/** Fills every field the form offers and saves. Returns the job's name. */
async function createJob(page: Page): Promise<string> {
  const name = `E2EMailer${uniqueSuffix()}`;

  await page.goto('/system/report-mailing-jobs/create', { waitUntil: 'networkidle' });

  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('textbox', { name: 'Email Recipients' }).fill('nobody@example.invalid');
  await page.getByRole('textbox', { name: 'Email Subject' }).fill('Nightly portfolio');
  await page.getByRole('textbox', { name: 'Email Message' }).fill('Attached.');

  // The report picker is populated from GET /reports; before this change the field was a bare
  // number box, so the operator had to know the id.
  const report = page.getByTestId('report-mailing-job-report');
  await report.click();
  await page.locator('ion-popover ion-radio, ion-popover ion-item').first().click();

  // `data-testid` lands on the ion-input host; the fillable element is the inner native input.
  await page.getByTestId('report-mailing-job-start').locator('input').fill('2027-01-04T09:00');

  return name;
}

test.describe('report mailing job creation', () => {
  test.use({ viewport: WIDE });

  test('is no longer refused for a missing parameter', async ({ page }) => {
    await login(page);

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/reportmailingjobs') && response.request().method() === 'POST',
    );

    await createJob(page);
    await page.getByRole('button', { name: 'Save' }).click();

    const response = await createResponse;
    const body = await response.text().catch(() => '');

    // A 400 here means the form left out something the platform demands, which is the defect
    // these cases exist for. The 500 from `number_of_runs` is the platform's, not ours.
    expect(response.status(), `validation failure: ${body}`).not.toBe(400);
    expect(body).not.toContain('is mandatory');
    expect(body).not.toContain('requires a `locale`');
  });

  test('the payload carries the locale and the schedule', async ({ page }) => {
    await login(page);

    const createRequest = page.waitForRequest(
      (request) => request.url().includes('/reportmailingjobs') && request.method() === 'POST',
    );
    await createJob(page);
    await page.getByRole('button', { name: 'Save' }).click();

    const body = (await createRequest).postDataJSON() as Record<string, unknown>;

    // Every parameter the platform names as mandatory, plus the locale stretchyReportId needs.
    expect(
      body['locale'],
      'locale missing — the platform refuses stretchyReportId without it',
    ).toBeTruthy();
    expect(body['stretchyReportId']).toBeTruthy();
    expect(body['emailMessage']).toBeTruthy();
    expect(body['emailAttachmentFileFormatId']).toBeTruthy();

    // A job with no recurrence and no start time is a row that never mails anything, and it is
    // indistinguishable from a working one unless the body is read.
    expect(body['recurrence']).toBeTruthy();
    expect(body['startDateTime']).toBeTruthy();
    // `yyyy-MM-dd HH:mm:ss`. The codebase's usual `dd MMMM yyyy` makes the platform throw once a
    // time is appended, so the shape matters and is worth pinning.
    expect(String(body['startDateTime'])).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(body['dateFormat']).toBe('yyyy-MM-dd HH:mm:ss');
  });
});

test.describe('report mailing job creation at the narrow viewport', () => {
  test.use({ viewport: NARROW });

  test('every field is reachable and the job still saves at 320px', async ({ page }) => {
    await login(page);
    await page.goto('/system/report-mailing-jobs/create', { waitUntil: 'networkidle' });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/reportmailingjobs') && response.request().method() === 'POST',
    );
    await createJob(page);
    await page.getByRole('button', { name: 'Save' }).click();

    const body = await (await createResponse).text().catch(() => '');
    expect(body).not.toContain('is mandatory');
  });
});
