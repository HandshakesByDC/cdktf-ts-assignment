import { describe, it, expect, beforeAll } from 'vitest';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  waitUntilObjectExists,
} from '@aws-sdk/client-s3';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { LambdaClient, waitUntilFunctionActive } from '@aws-sdk/client-lambda';
import { readFileSync, statSync } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// LocalStack configuration
const localstackConfig = {
  endpoint: 'http://localhost.localstack.cloud:4566',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
  forcePathStyle: true,
};

const s3 = new S3Client(localstackConfig);
const ssm = new SSMClient(localstackConfig);
const lambda = new LambdaClient(localstackConfig);

// Helper function for polling
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to get SSM parameter value
async function getParameterValue(name: string): Promise<string> {
  const result = await ssm.send(new GetParameterCommand({ Name: name }));
  return result.Parameter?.Value!;
}

describe('LocalStack Integration Tests', () => {
  // Wait for all Lambda functions to be active before running tests
  beforeAll(async () => {
    const lambdaNames = ['presign', 'resize', 'list'];
    await Promise.all(
      lambdaNames.map((functionName) =>
        waitUntilFunctionActive(
          { client: lambda, maxWaitTime: 120 },
          { FunctionName: functionName }
        )
      )
    );
  }, 130000); // 130 second timeout for beforeAll

  it('should resize uploaded image (test_s3_resize_integration)', async () => {
    const filePath = path.join(__dirname, 'nyan-cat.png');
    const key = path.basename(filePath);
    const fileContent = readFileSync(filePath);
    const originalSize = statSync(filePath).size;

    // Get bucket names from SSM
    const sourceBucket = await getParameterValue('/localstack-thumbnail-app/buckets/images');
    const targetBucket = await getParameterValue('/localstack-thumbnail-app/buckets/resized');

    try {
      // Upload file to source bucket
      await s3.send(
        new PutObjectCommand({
          Bucket: sourceBucket,
          Key: key,
          Body: fileContent,
        })
      );

      // Wait for resized image to appear in target bucket
      await waitUntilObjectExists(
        { client: s3, maxWaitTime: 60 },
        { Bucket: targetBucket, Key: key }
      );

      // Get the resized image and verify size
      const resizedObject = await s3.send(
        new GetObjectCommand({
          Bucket: targetBucket,
          Key: key,
        })
      );

      const resizedSize = resizedObject.ContentLength!;
      expect(resizedSize).toBeLessThan(originalSize);
    } finally {
      // Cleanup - delete objects from both buckets
      await Promise.all([
        s3.send(new DeleteObjectCommand({ Bucket: sourceBucket, Key: key })),
        s3.send(new DeleteObjectCommand({ Bucket: targetBucket, Key: key })),
      ]).catch(() => {
        // Ignore cleanup errors
      });
    }
  }, 90000); // 90 second timeout

  it('should send error email when processing fails (test_failure_sns_to_ses_integration)', async () => {
    const filePath = path.join(__dirname, 'some-file.txt');
    const key = `${randomUUID()}-${path.basename(filePath)}`;
    const fileContent = readFileSync(filePath);

    // Get source bucket name from SSM
    const sourceBucket = await getParameterValue('/localstack-thumbnail-app/buckets/images');

    try {
      // Upload non-image file to trigger Lambda failure
      await s3.send(
        new PutObjectCommand({
          Bucket: sourceBucket,
          Key: key,
          Body: fileContent,
        })
      );

      // Poll for SES message
      let messageFound = false;
      for (let i = 0; i < 10; i++) {
        const response = await fetch('http://localhost:4566/_aws/ses');
        const data = (await response.json()) as {
          messages: Array<{ Body: { text_part: string } }>;
        };
        const messages = data.messages;

        if (messages.length > 0 && messages[messages.length - 1].Body.text_part.includes(key)) {
          messageFound = true;
          break;
        }

        await sleep(1000);
      }

      expect(messageFound).toBe(true);
    } finally {
      // Cleanup
      await s3.send(new DeleteObjectCommand({ Bucket: sourceBucket, Key: key })).catch(() => {
        // Ignore cleanup errors
      });
    }
  }, 60000); // 60 second timeout
});
