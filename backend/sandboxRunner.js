const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { isSupportedLanguage } = require("./languages");
const { dirCodes } = require("./generateFile");

const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE || "compiler-sandbox";
const SANDBOX_RUNTIME = process.env.SANDBOX_RUNTIME; // optional, e.g. "runsc"
const HARD_TIMEOUT_MS = Number(process.env.SANDBOX_HARD_TIMEOUT_MS) || 30 * 1000;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_SOURCE_BYTES = 200 * 1024;

const failure = (message) => {
    const err = new Error(message);
    err.stderr = message;
    return err;
};

const runContainer = (source, language) =>
    new Promise((resolve, reject) => {
        const name = `sbx-${crypto.randomUUID()}`;
        const args = [
            "run", "--rm", "-i", "--name", name,
            "--network=none",
            "--memory=512m", "--memory-swap=512m",
            "--cpus=1",
            "--pids-limit=128",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            "--read-only",
            "--tmpfs", "/work:rw,exec,nosuid,size=64m,uid=1000,gid=1000",
            "--tmpfs", "/tmp:rw,nosuid,size=32m",
            "--user", "1000:1000",
        ];
        if (SANDBOX_RUNTIME) args.push(`--runtime=${SANDBOX_RUNTIME}`);
        args.push(SANDBOX_IMAGE, language);

        const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });

        const out = [];
        const errOut = [];
        let bytes = 0;
        let settled = false;

        const finish = (fn, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(watchdog);
            fn(value);
        };

        const killContainer = () => {
            spawn("docker", ["kill", name], { stdio: "ignore" }).on("error", () => {});
            child.kill("SIGKILL");
        };

        const watchdog = setTimeout(() => {
            killContainer();
            finish(reject, failure("Time limit exceeded"));
        }, HARD_TIMEOUT_MS);

        const collect = (target) => (chunk) => {
            bytes += chunk.length;
            if (bytes > MAX_OUTPUT_BYTES) {
                killContainer();
                finish(reject, failure("Output limit exceeded (1 MB)"));
                return;
            }
            target.push(chunk);
        };
        child.stdout.on("data", collect(out));
        child.stderr.on("data", collect(errOut));

        child.on("error", (e) => finish(reject, failure(`Failed to start sandbox: ${e.message}`)));

        child.on("close", (code) => {
            const stdout = Buffer.concat(out).toString("utf8");
            const stderr = Buffer.concat(errOut).toString("utf8");
            if (code !== 0) {
                return finish(reject, failure((stdout + stderr).trim() || `Process exited with code ${code}`));
            }
            finish(resolve, stdout);
        });

        child.stdin.on("error", () => {});
        child.stdin.end(source);
    });

const runInSandbox = async (filepath, language) => {
    if (!isSupportedLanguage(language)) {
        throw failure("Language not supported");
    }
    const filename = path.basename(String(filepath));
    if (!/^[a-zA-Z0-9_-]+\.(cpp|c|py|java)$/.test(filename)) {
        throw failure("invalid source filename");
    }
    const safePath = path.join(dirCodes, filename);

    try {
        let source;
        try {
            source = fs.readFileSync(safePath);
        } catch (e) {
            throw failure("source file not found");
        }
        if (source.length > MAX_SOURCE_BYTES) {
            throw failure("Source code too large");
        }
        return await runContainer(source, language);
    } finally {
        fs.rmSync(safePath, { force: true });
    }
};

module.exports = { runInSandbox };