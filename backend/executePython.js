const { exec } = require("child_process");

const executePython = (filepath) => {
    return new Promise((resolve, reject) => {
        exec(`python "${filepath}"`, (error, stdout, stderr) => {
            if (error) {
                return reject({ stderr: stderr || error.message });
            }
            if (stderr) {
                return reject({ stderr: stderr });
            }
            resolve(stdout);
        });
    });
};

module.exports = { executePython };