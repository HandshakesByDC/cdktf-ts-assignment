import * as path from "path";
import { App, AssetType, TerraformAsset, TerraformOutput, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { LambdaFunction } from "@cdktn/provider-aws/lib/lambda-function";
import { LambdaFunctionUrl } from "@cdktn/provider-aws/lib/lambda-function-url";
import { AwsProvider } from "@cdktn/provider-aws/lib/provider";
import { LocalProvider } from "@cdktn/provider-local/lib/provider";
import { lambdaLibs } from "./lib/bundling";
import { S3Bucket } from "@cdktn/provider-aws/lib/s3-bucket";
import { File } from "@cdktn/provider-local/lib/file";

class BackendStack extends TerraformStack {
  public readonly buckets: string[];
  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.buckets = [];

    const lambdaRole = "arn:aws:iam::000000000000:role/lambda-role";
    new AwsProvider(this, "aws");

    // TODO: Create S3 Buckets for ["images", "resized"]

    // TODO: Create SSM Parameters /localstack-thumbnail-app/buckets/["images", "resized"]

    // TODO: Create failed-resize SNS Topic and Subscription (email protocol)

    // build lambdas/resize/libs folder
    lambdaLibs("lambdas/resize");
    // reference https://developer.hashicorp.com/terraform/cdktf/concepts/assets
    const resizeAsset = new TerraformAsset(this, "resize-asset", {
      path: path.join(__dirname, "lambdas/resize"),
      type: AssetType.ARCHIVE,
    });

    // TODO: Create Lambda function for resize

    // TODO: Set resize lambda's deadLetterConfig to failed-resize SNS Topic

    // TODO: Set LambdaFunctionEventInvokeConfig

    // TODO: Set S3BucketNotification for images bucket to Trigger resize lambda on "s3:ObjectCreated:*" events

    const functions = ["list", "presign"];
    for (const functionName of functions) {
      const asset = new TerraformAsset(this, `${functionName}-asset`, {
        path: path.join(__dirname, `lambdas/${functionName}`),
        type: AssetType.ARCHIVE,
      });
      const lambdaFunction = new LambdaFunction(this, `${functionName}-function`, {
        functionName,
        handler: "handler.handler",
        runtime: "python3.9",
        role: lambdaRole,
        filename: asset.path,
        sourceCodeHash: asset.assetHash,
        environment: {
          variables: {
            STAGE: "local",
          },
        }
      });
      const functionUrl = new LambdaFunctionUrl(this, `${functionName}-function-url`, {
        functionName: lambdaFunction.functionName,
        authorizationType: "NONE",
      });
      new TerraformOutput(this, `${functionName.toUpperCase()}_url`, {
        value: functionUrl.functionUrl,
      });
    }
  }
}

class FrontEndStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new AwsProvider(this, "aws");
    new LocalProvider(this, "local");

    let bucket: S3Bucket | undefined;
    // TODO: Create S3 Buckets for "webapp" assign to bucket variable

    // TODO: Set S3BucketWebsiteConfiguration and s3 policy for PulblicRead

    // Write dotenv config for website deploy script
    new File(this, "env",{
        filename: path.join(__dirname, "website", ".env.local"),
        content: `S3_BUCKET_FRONTEND=${bucket?.bucket}`
    });

    // output bucket Name
    new TerraformOutput(this, "localstack_url", {
        value: `http://${bucket?.bucket}.s3-website.localhost.localstack.cloud:4566`,
    });
  }
}


const app = new App();
new BackendStack(app, "iac-assignment-backend");
new FrontEndStack(app, "iac-assignment-frontend");
app.synth();