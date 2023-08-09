/* eslint-disable no-console */
import middy from "@middy/core";
import { StatusCodes } from "http-status-codes";
import { awsLambdaResponse } from "../../shared/aws";
import { winstonLogger } from "../../shared/logger";
import { S3 } from "aws-sdk";
import chromium from "@sparticuz/chromium";

import puppeteer from "puppeteer";
import { PuppeteerError } from "./puppeteer-error";
import { randomUUID } from "crypto";

const s3 = new S3();

interface SimpleFlowSelectors {
  password: string;
  email: string;
  signInRedirectButton: string;
  confirmSignInButton: string;
}

interface ScrapeWithAuthEvent {
  url: string;
  jsCode: string;
  selectors: SimpleFlowSelectors;
}

const lambdaHandler = async (event: ScrapeWithAuthEvent) => {
  const { url, jsCode, selectors } = event;

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    await page.goto(url || "https://www.tsh.io", { waitUntil: "networkidle0" });

    const signInSelector = selectors.signInRedirectButton;
    const emailSelector = selectors.email;
    const passwordSelector = selectors.password;
    const confirmSignInSelector = selectors.confirmSignInButton;

    page.waitForTimeout(1320); // apply different timeouts to avoid bot detection

    const signInRedirect = await page.waitForSelector(signInSelector);
    if (!signInRedirect) {
      throw new PuppeteerError("Could not find sign in button", page);
    }

    page.waitForTimeout(2230);
    await signInRedirect.click();

    const emailInput = await page.waitForSelector(emailSelector);
    if (!emailInput) {
      throw new PuppeteerError("Could not find email input", page);
    }

    const passwordInput = await page.waitForSelector(passwordSelector);
    if (!passwordInput) {
      throw new PuppeteerError("Could not find password input", page);
    }

    const confirmSignIn = await page.waitForSelector(confirmSignInSelector);
    if (!confirmSignIn) {
      throw new PuppeteerError("Could not find confirm sign in button", page);
    }

    page.waitForTimeout(2100);

    await emailInput.type(process.env.EMAIL!, { delay: 100 }); // should be fetched from secrets manager probably
    await passwordInput.type(process.env.PASSWORD!, { delay: 100 });

    await page.waitForTimeout(1300);

    await confirmSignIn.click({ delay: 200 });

    await page.waitForTimeout(1000);

    await page.waitForNavigation();

    const result = await page.evaluate(async (code) => {
      // eslint-disable-next-line no-eval
      eval(code);
    }, jsCode);
    winstonLogger.debug(`Result of your injected script: ${result}`);

    winstonLogger.info(`Chromium: ${await browser.version()}`);
    winstonLogger.info(`Page Title: ${await page.title()}`);

    await page.close();

    await browser.close();
  } catch (error) {
    if (error instanceof PuppeteerError) {
      const screenshotBuffer = await error.page.screenshot();
      const uuid = randomUUID();

      await s3
        .putObject({
          Bucket: process.env.SCREENSHOT_BUCKET_NAME!,
          Key: `${new Date().toISOString}/bug${uuid}.png`,
          Body: screenshotBuffer,
        })
        .promise();
    }

    throw new Error(`Error while processing ${event.url} - ${error}`);
  }

  winstonLogger.info("Post connection");

  return awsLambdaResponse(StatusCodes.OK, {
    success: true,
  });
};

export const handle = middy().handler(lambdaHandler);
