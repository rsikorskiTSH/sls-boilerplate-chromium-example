import httpEventNormalizer from "@middy/http-event-normalizer";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import middy from "@middy/core";
import { awsLambdaResponse } from "../../shared/aws";
import { winstonLogger } from "../../shared/logger";
import { ConnectionManager } from "../../shared/utils/connection-manager";
import { ExampleModel } from "../../shared/models/example.model";
import { v4 } from "uuid";
import { createConfig } from "./config";
import { ExampleLambdaPayload, exampleLambdaSchema } from "./event.schema";
import { inputOutputLoggerConfigured } from "../../shared/middleware/input-output-logger-configured";
import { queryParser } from "../../shared/middleware/query-parser";
import { zodValidator } from "../../shared/middleware/zod-validator";
import { httpErrorHandlerConfigured } from "../../shared/middleware/http-error-handler-configured";

const config = createConfig(process.env);

const lambdaHandler = async (event: ExampleLambdaPayload) => {
  winstonLogger.info(`Hello from ${config.appName}. Example param is: ${event.queryStringParameters.exampleParam}`);

  const connectionManager = new ConnectionManager();
  const connection = await connectionManager.getConnection();

  await connection.getRepository(ExampleModel).save(
    ExampleModel.create({
      id: v4(),
      email: "some@tmp.pl",
      firstName: "Test",
      lastName: "User",
    }),
  );

  return awsLambdaResponse(200, {
    success: true,
    data: {
      users: await connection.getRepository(ExampleModel).find({}),
      exampleParam: event.queryStringParameters.exampleParam,
    },
  });
};

export const handle = middy()
  .use(inputOutputLoggerConfigured())
  .use(httpEventNormalizer())
  .use(httpHeaderNormalizer())
  .use(zodValidator(exampleLambdaSchema))
  .use(queryParser())
  .use(httpErrorHandlerConfigured)
  .handler(lambdaHandler);
