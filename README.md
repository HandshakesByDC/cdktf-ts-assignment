# LocalStack Image Resizer Assignment

> [!IMPORTANT]
> This quickstart has been tested on Darwin/Linux only - recommended to use WSL if on Windows.

In this assignment we will focus on:

- AWS Services (without requiring an AWS Account)
- CDK for Terraform (Typescript) (in future: [CDK Terrain](http://cdktn.io))
- GitHub Workflow Integration test

## Overview

The task is to implement this [Localstack: Quickstart](./QUICKSTART.md) in CDKTF!

> [!NOTE]
> Handshakes is adopting [CDK Terrain](http://cdktn.io) for longterm support since Hashicorp has sunset CDKTF.

![Architecture](docs/images/arch.png)

## Pre-req

Please make sure that you have the following working on your machine:

- [AWS cli](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html#getting-started-install-instructions) only (we will use localstack so no aws credentials required)

- NodeJS installation - we use [mise](https://mise.jdx.dev/getting-started.html)
  ```bash
  mise trust .
  # installs node, terraform, localstack, terraform-local, awscli-local, ...
  mise install

  # NodeJS shims for pnpm/yarn using corepack
  corepack enable
  pnpm install
  ```

- Docker environment - we use [colima](https://github.com/abiosoft/colima) on MacOS - not in repo dependencies, may use global install:
  ```bash
  mise use -g colima@latest
  ```

- Terraform (i.e. managed through [mise](https://mise.jdx.dev/getting-started.html))
  ```bash
  # should show terraform version installed by mise from step above
  mise ls
  ```

- standard utilities `jq`, `zip` & `curl`

See also this CDKTF getting started guides:

- [cdktf python example](https://github.com/cdktf/cdktf-integration-serverless-python-example/blob/main/README.md)

## Set up

Pre-Req (automated with `mise install` above)

```console
node --version        # 20.x pinned
terraform --version   # 1.7.5 pinned
localstack --version  # 4.12.0 pinned
tflocal --version     # localstack wrapper for terraform
awslocal --version    # localstack wrapper for aws cli

docker version        # colima glabal install
```

Ensure all required dependencies are installed

```console
pnpm i
```

## Explore Env

```console
pnpm localstack:start
```

> Note: To see SNS Emails, should be able to use DATA_DIR [see: issue comment](https://github.com/localstack/localstack/issues/2682#issuecomment-992701277).

## Assignment

This repo has been modified to be deployed using CDKTF IaC. The ultimate goal is to make the GH Workflow pass.

The exact shell commands to achieve a working configuration are in [deploy.sh](https://github.com/localstack-samples/sample-serverless-image-resizer-s3-lambda/blob/09ff2b2529b8a56984a72eda17f071460f4c1af6/bin/deploy.sh)

However, you may only run `cdktf` commands in GH Runner to achieve the working configuration.

> [!IMPORTANT] 
> Fix the [./main.ts](./main.ts) file to implement the following TODOs across both stacks.

## Backend stack

### Backend Overview

- `images` and `resized` S3 buckets
- `list`, `presign` and `resize` Lambda Functions
- S3 bucket event trigger for `resize` Lambda Function

### Backend Todo

> [!NOTE]
> Ask the AI Agent to write Unit Tests first before implementing as fast feedback loop (TDD).

- [ ] Create S3 buckets
- [ ] Create SSM Paramaters for Lambda handlers to work
- [ ] Create SNS Topic to receive dead letter notifications when resize lambda fails
- [ ] Create resize lambda
- [ ] Create images bucket event trigger for resize lambda

### Backend deploy

```console
pnpm synth
TERRAFORM_BINARY_NAME=tflocal pnpm exec cdktf apply iac-assignment-backend
```

> You may use `--skip-synth` to speed up apply.

## Frontend stack

### Frontend Overview

- `webapp` S3 bucket
- `.env.local` file with Env config

### Frontend Todo

- [ ] Create S3 bucket for webapp
- [ ] Create webapp S3 Bucket website configuration and s3 policy

### Frontend Deploy

```console
TERRAFORM_BINARY_NAME=tflocal pnpx cdktf apply iac-assignment-frontend
```

Copy `website` to `webapp` S3 Bucket (uses `website/.env.local` config from `cdktf apply`):

```console
pnpm --prefix website install
pnpm --prefix website run deploy
```

## Integration test

1. Run integration tests:
   ```bash
   pnpm test:integ
   ```

1. Verify both tests pass:
   - Image resize test uploads and verifies smaller resized image
   - Failure test triggers error email via SNS/SES

**Note:** The GitHub Actions workflow won't run tests successfully until the CDKTF deployment TODOs are implemented.

### Testing Todo

Make the [GitHub Workflow](.github/workflows/pr.yaml) pass

- [ ] Set up CDKTF cli in GitHub Runner
- [ ] Deploy Backend with CDKTF
- [ ] Deploy Frontend with CDKTF

![PR Result](docs/images/pr-result.png)

### Testing Bonus points

[Terraform Unit Test docs](https://developer.hashicorp.com/terraform/cdktf/test/unit-tests)

- [ ] Implement CDKTF Unit tests in [main.test.ts](./main.test.ts)
- [ ] Implement Unit tests for `list`, `presign` and `resize` functions
- [ ] Refactor IaC to split backend and frontend stacks in separate code files
- [ ] Run Unit tests in pre-commit

## Debug Tips

LocalStack debug logs show lambda invocations and logs:

```console
localstack logs -f
```

To check resize dead letter notifications:

```console
curl -s http://localhost:4566/_aws/ses | jq -r '.messages[0] | {Destination, "Message": (.Body.text_part | fromjson)}' 
```
