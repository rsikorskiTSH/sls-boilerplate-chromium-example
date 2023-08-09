import middy from "@middy/core";
import { StatusCodes } from "http-status-codes";
import { awsLambdaResponse } from "../../shared/aws";
import { winstonLogger } from "../../shared/logger";
import puppeteer from "puppeteer";
import chromium from "@sparticuz/chromium";

const lambdaHandler = async (event: { url: string; jsCode: string }) => {
  winstonLogger.info("Pre connection");
  const { jsCode } = event;

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.goto(event.url || "https://www.tsh.io", { waitUntil: "networkidle0" });

    if (jsCode) {
      const result = await page.evaluate((code) => {
        // eslint-disable-next-line no-eval
        return eval(code); // Execute the JavaScript code provided as "jsCode"
      }, jsCode);
      winstonLogger.debug(`Result of your injected script: ${result}`);
    }

    winstonLogger.info(`Chromium: ${await browser.version()}`);
    winstonLogger.info(`Page Title: ${await page.title()}`);

    const pages = await browser.pages();

    const toClose = pages.map(async (pageToClose) => {
      await pageToClose.close();
    });

    await Promise.all(toClose);

    await browser.close();
  } catch (error) {
    throw new Error(`Error while processing ${event.url} - ${error}`);
  }

  winstonLogger.info("Post connection");

  return awsLambdaResponse(StatusCodes.OK, {
    success: true,
  });
};

export const handle = middy().handler(lambdaHandler);
