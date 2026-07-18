const { exec } = require("child_process");
const path = require("path");

const executeJava = (filePath) => {
    return new Promise((resolve, reject) => {
        // ✅ FIX 1: normalize cleans up any double-escaped backslashes
        const normalizedPath = path.normalize(filePath.trim());
        const dir = path.dirname(normalizedPath);
        const fileName = path.basename(normalizedPath, ".java");

        exec(
            `javac "${normalizedPath}" && java -cp "${dir}" ${fileName}`,
            (error, stdout, stderr) => {
                if (error) {
                    console.error(stderr);
                    // ✅ FIX 2: return both stderr and message for better debugging
                    return reject({ stderr, message: error.message });
                }
                resolve(stdout);
            }
        );
    });
};

module.exports = { executeJava };