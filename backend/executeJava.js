const { exec } = require("child_process");
const path = require("path");

const executeJava = (filePath) => {
    return new Promise((resolve, reject) => {
        const dir = path.dirname(filePath);
        const fileName = path.basename(filePath, ".java");

        exec(
            `javac "${filePath}" && java -cp "${dir}" ${fileName}`,
            (error, stdout, stderr) => {
                if (error) return reject({ error, stderr });
                if (stderr) return reject(stderr);
                resolve(stdout);
            }
        );
    });
};
        
module.exports = { executeJava };