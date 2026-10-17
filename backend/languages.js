const LANGUAGES = {
    cpp:    { ext: "cpp" },
    c:      { ext: "c" },
    python: { ext: "py" },
    java:   { ext: "java" },
};

const isSupportedLanguage = (language) =>
    typeof language === "string" && Object.prototype.hasOwnProperty.call(LANGUAGES, language);

module.exports = { LANGUAGES, isSupportedLanguage };