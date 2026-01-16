# Verification Steps

## Prerequisites

- Node.js 20+
- pnpm
- LocalStack CLI
- CDKTF CLI

## Running Integration Tests Locally

1. Start LocalStack:
   ```bash
   pnpm localstack:start
   ```

2. Deploy infrastructure locally:
   ```bash
   pnpm cdktf deploy --auto-approve
   ```

3. Run integration tests:
   ```bash
   pnpm test:integ
   ```

4. Verify both tests pass:
   - Image resize test uploads and verifies smaller resized image
   - Failure test triggers error email via SNS/SES

**Note:** The GitHub Actions workflow won't run tests successfully until the CDKTF deployment TODOs are implemented.
