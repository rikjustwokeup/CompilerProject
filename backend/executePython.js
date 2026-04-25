const { exec } = require("child_process");

const executePython = (filepath) => {
    return new Promise((resolve) => {
        exec(`python "${filepath}"`, (error, stdout, stderr) => {
            if (error) return resolve({ error: stderr });
            resolve( stdout );
        });
    });
};

module.exports = { executePython };