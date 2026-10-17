const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const { LANGUAGES, isSupportedLanguage } = require('./languages');

const dirCodes = path.join(__dirname, "codes");

if (!fs.existsSync(dirCodes)) {
    fs.mkdirSync(dirCodes, { recursive: true });
}

const generateFile = async (language, code) => {
    if (!isSupportedLanguage(language)) {
        throw new Error("Language not supported")
    }

    const filename = `${uuid()}.${LANGUAGES[language].ext}`;
    const filepath = path.join(dirCodes, filename);
    fs.writeFileSync(filepath, code.trim() + "\n");     //consistent trim for all languages
    return filepath;
};

module.exports = { generateFile, dirCodes };