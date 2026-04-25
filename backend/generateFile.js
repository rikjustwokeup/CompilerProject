const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

const dirCodes = path.join(__dirname, "codes");

if (!fs.existsSync(dirCodes)) {
    fs.mkdirSync(dirCodes, { recursive: true });
}

const generateFile = async (format, code) => {

    //FIX FOR JAVA
    if (format === "java") {
        const filename = "Main.java"; // must match class name
        const filepath = path.join(dirCodes, filename);

        fs.writeFileSync(filepath, code);
        return filepath;
    }

    //other languages
    const jobId = uuid();
    const filename = `${jobId}.${format}`;
    const filepath = path.join(dirCodes, filename);

    fs.writeFileSync(filepath, code);
    return filepath;
};

module.exports = {
    generateFile,
};