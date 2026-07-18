const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

const dirCodes = path.join(__dirname, "codes");

if (!fs.existsSync(dirCodes)) {
    fs.mkdirSync(dirCodes, { recursive: true });
}

const generateFile = async (format, code) => {
    // that were corrupting the javac exec command with \n at the end

    if (format === "java") {
        const filename = "Main.java"; 
        const filepath = path.join(dirCodes, filename);
        fs.writeFileSync(filepath, code.trim()); 
        return filepath.trim();                  
    }

    const jobId = uuid();
    const filename = `${jobId}.${format}`;
    const filepath = path.join(dirCodes, filename);
    fs.writeFileSync(filepath, code.trim());     //consistent trim for all languages
    return filepath.trim();
};

module.exports = {
    generateFile,
};