/**
 * Simple python bundling function for lambda functions
 * 
 * @param lambdaDir - directory of the lambda function 
 */
export function lambdaLibs(lambdaDir: string) {
  // check osName
    const osName = process.platform;
    let commands = [];
    if (osName === "darwin") {
        // MacOS specific commands
        commands = [
            "rm -rf libs PIL Pillow* *.dist-info",
            'docker run --platform linux/x86_64 -v "$PWD":/var/task public.ecr.aws/sam/build-python3.9 /bin/sh -c "pip install -qq --root-user-action=ignore -r requirements.txt -t libs; exit"',
            "mv libs/* . && rm -rf libs",
        ];
    } else if (osName === "linux") {
        // Other OS (assuming Linux) specific commands
        commands = [
            "rm -rf libs PIL Pillow* *.dist-info && mkdir libs",
            "pip install -qq --root-user-action=ignore -r requirements.txt -t libs --platform manylinux_2_28_x86_64 --python-version 3.9 --no-deps",
            "mv libs/* . && rm -rf libs",
        ];
    } else {
      throw new Error(`Unsupported OS: ${osName}`);
    }
    console.info(`Bundling lambda dependencies for OS: ${osName}`);
    runCommands(commands, lambdaDir);
    console.info("Bundling complete.");
}

/**
 * Run a list of commands in a given directory
 * 
 * @param commands - list of commands to run
 * @param cwd - current working directory
*/
function runCommands(commands: string[], cwd: string = process.cwd()) {
    const execSync = require("child_process").execSync;
    try {
        for (const command of commands) {
            execSync(command, { stdio: "pipe", cwd });
        }
    } catch (error: unknown) {
        const execError = error as { stderr?: Buffer; stdout?: Buffer };
        console.error("Error executing commands:");
        if (execError.stderr) console.error(execError.stderr.toString());
        if (execError.stdout) console.error(execError.stdout.toString());
        process.exit(1);
    }
}
