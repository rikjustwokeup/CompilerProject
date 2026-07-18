const { exec } = require("child_process");

const executeC = (filePath) => {
    return new Promise((resolve, reject) => {
        const outputPath = filePath.replace(".c", ".exe");

        exec(
            `gcc "${filePath}" -o "${outputPath}" && "${outputPath}"`,
            (error, stdout, stderr) => {
                if (error) {
                    return reject({ stderr: stderr || error.message });
                }
                if (stderr) {
                    return reject({ stderr: stderr });
                }
                resolve(stdout);
            }
        );
    });
};

module.exports = { executeC };