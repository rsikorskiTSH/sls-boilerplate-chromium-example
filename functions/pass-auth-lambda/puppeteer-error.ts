import { Page } from "puppeteer";

export class PuppeteerError extends Error {
  page: Page;

  constructor(message: string, page: Page) {
    super(message);
    this.page = page;
    this.name = "PuppeteerError"; // Set the name of the error
  }
}
