import middy from "@middy/core";
import { StatusCodes } from "http-status-codes";
import { awsLambdaResponse } from "../../shared/aws";
import { winstonLogger } from "../../shared/logger";
import puppeteer from "puppeteer-core";

import chromium from "@sparticuz/chromium";

const lambdaHandler = async (event: { url: string }) => {
  winstonLogger.info("Pre connection");

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    winstonLogger.info(`Browser: ${browser.isConnected()}`);
    await page.goto(event.url || "https://www.tsh.io", { waitUntil: "networkidle0" });

    // page.evaluate(() => {
    //   const topicsList: string[] = [];

    //   const topicElements: = document.querySelectorAll(".topic");

    //   topicElements.forEach((element: ElementHandle) => {
    //     topicsList.push(element.textContent);
    //   });

    //   winstonLogger.info(`Found topics: ${topicsList.join(", ")}`);
    // });

    winstonLogger.info(`Chromium: ${await browser.version()}`);
    winstonLogger.info(`Page Title: ${await page.title()}`);

    await page.close();

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
