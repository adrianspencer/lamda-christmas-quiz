#!/usr/bin/env node
/**
 * LAMDA Christmas Quiz: 20 synthetic contestants.
 * Opens 20 real browser tabs, joins each contestant, then submits a harmless
 * test answer whenever the quizmaster opens a question. The quizmaster still
 * controls start/reveal/next/finish from the normal host screen.
 */
const { chromium } = require('playwright');

const BASE_URL = process.argv[2] || 'https://test-results.lamda-christmas-quiz.pages.dev/';
const PLAYER_COUNT = Number(process.env.PLAYERS || 20);
const PREFIX = process.env.NAME_PREFIX || 'Stress Test';
const POLL_MS = 400;
const MAX_RUN_MS = Number(process.env.MAX_MINUTES || 180) * 60 * 1000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  if (!/^https?:\/\//i.test(BASE_URL)) {
    throw new Error('Pass a full https:// URL for the quiz.');
  }
  if (!Number.isInteger(PLAYER_COUNT) || PLAYER_COUNT < 1 || PLAYER_COUNT > 20) {
    throw new Error('PLAYERS must be between 1 and 20.');
  }

  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const contestants = [];

  console.log(`Opening ${PLAYER_COUNT} contestant tabs at ${BASE_URL}`);
  try {
    for (let i = 1; i <= PLAYER_COUNT; i++) {
      const page = await context.newPage();
      contestants.push({ page, name: `${PREFIX} ${String(i).padStart(2, '0')}`, lastQuestion: '' });
    }

    // Load all contestant pages concurrently.
    await Promise.all(contestants.map(async ({ page }) => {
      page.setDefaultTimeout(30000);
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /enter the quiz/i }).click();
      await page.locator('#nameInput').waitFor({ state: 'visible' });
    }));

    console.log('Submitting the 20 join forms…');
    // Small stagger avoids a perfectly simultaneous burst while still testing
    // multiple joins arriving almost together.
    await Promise.all(contestants.map(async ({ page, name }, index) => {
      await sleep(index * 120);
      await page.locator('#nameInput').fill(name);
      await page.getByRole('button', { name: /join quiz/i }).click();
      await page.getByText(`YOU'RE IN, ${name}!`, { exact: false }).waitFor({ state: 'visible', timeout: 30000 });
      console.log(`✓ Joined: ${name}`);
    }));

    console.log(`\n${PLAYER_COUNT} contestants joined. Check the host lobby count, then start the quiz.`);
    console.log('The tabs will now wait. When the host opens each question, every contestant submits a test answer automatically.');
    console.log('You still control reveal, marking, next question and final rankings from the host screen.');
    console.log('Keep this Terminal window open. Press Ctrl+C to stop the test.\n');

    const startedAt = Date.now();
    let totalAnswers = 0;
    const completed = new Set();

    while (Date.now() - startedAt < MAX_RUN_MS) {
      await Promise.all(contestants.map(async contestant => {
        const { page, name } = contestant;
        if (page.isClosed() || completed.has(name)) return;
        try {
          const finalScreen = await page.locator('.player-results-screen').count();
          if (finalScreen) {
            completed.add(name);
            console.log(`🏁 Final results reached: ${name}`);
            return;
          }
          const answerBox = page.locator('#gameAnswer');
          if (await answerBox.count()) {
            const visible = await answerBox.isVisible().catch(() => false);
            if (!visible) return;
            const questionLabel = await page.locator('.question-count').innerText().catch(() => 'question');
            if (contestant.lastQuestion === questionLabel) return;
            contestant.lastQuestion = questionLabel;
            await answerBox.fill(`Automated test answer — ${name} — ${questionLabel}`);
            await page.getByRole('button', { name: /submit answer/i }).click();
            totalAnswers++;
            console.log(`↳ ${name} submitted ${questionLabel} (total submissions: ${totalAnswers})`);
          }
        } catch (error) {
          console.error(`Issue with ${name}: ${error.message}`);
        }
      }));
      if (completed.size === contestants.length) break;
      await sleep(POLL_MS);
    }

    console.log(`\nTest session ended. Automated submissions: ${totalAnswers}.`);
    console.log('The browser remains open so you can inspect the contestant tabs and final screens.');
    console.log('Press Ctrl+C here when you are finished inspecting.');
    await new Promise(() => {});
  } finally {
    // Deliberately do not reset the quiz or close the browser automatically.
    // The operator can inspect results and use the host controls to reset.
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
