const express = require("express");
const cors = require("cors");
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const { generateFile } = require('./generatefile');
const { addJobToQueue } = require('./jobQueue');
const Job = require("./Models/Job");

//mongo section
const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/compilerapp');
        console.log("MongoDB Connected");
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

//upload section

const upload = multer({ dest: 'uploads/' });

const MIME_MAP = {
    '.js':   'application/javascript',
    '.py':   'text/x-python',
    '.cpp':  'text/x-c++src',
    '.c':    'text/x-csrc',
    '.java': 'text/x-java-source',
    '.ts':   'application/typescript',
    '.txt':  'text/plain',
    '.json': 'application/json',
    '.html': 'text/html',
    '.css':  'text/css',
};

async function uploadFileToDrive(localFilePath, fileName) {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, 'service-account-key.json'),
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });
    const ext = path.extname(fileName).toLowerCase();
    const mimeType = MIME_MAP[ext] || 'text/plain';

    const response = await drive.files.create({
        requestBody: { name: fileName },
        media: {
            mimeType,
            body: fs.createReadStream(localFilePath),
        },
        fields: 'id, name, webViewLink',
    });

    fs.unlinkSync(localFilePath); // clean up temp file
    return response.data;
}

// ── App ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── Existing routes (unchanged) ─────────────────────────────────────
app.get("/status", async (req, res) => {
    const jobId = req.query.id;
    console.log("status requested", jobId);
    if (jobId == undefined) {
        return res.status(400).json({ success: false, error: "missing id query param" });
    }
    try {
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ success: false, error: "invalid job id" });
        }
        return res.status(200).json({ success: true, job });
    } catch (err) {
        return res.status(400).json({ success: false, error: err.message });
    }
});

app.post("/run", async (req, res) => {
    const { language = "cpp", code } = req.body;
    console.log(language, code ? code.length : 0);
    if (!code) {
        return res.status(400).json({ success: false, error: "Empty code body" });
    }
    let job;
    try {
        const filepath = await generateFile(language, code);
        job = await new Job({ language, filepath, code }).save();
        const jobId = job["_id"];
        addJobToQueue(jobId);
        console.log(job);
        res.status(201).json({ success: true, jobId });
    } catch (err) {
        return res.status(500).json({ success: false, err: JSON.stringify(err) });
    }
});

// ── New: upload file to Drive ───────────────────────────────────────
app.post("/upload", upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: "No file provided" });
    }
    const allowedExtensions = [
        '.js',
        '.py',
        '.cpp',
        '.c',
        '.java',
        '.ts',
        '.txt',
        '.json',
        '.html',
        '.css'
    ];

    const ext = path.extname(req.file.originalname).toLowerCase();

    if (!allowedExtensions.includes(ext)) {
        fs.unlinkSync(req.file.path);

        return res.status(400).json({
            success: false,
            error: "Unsupported file type"
        });
    }
    try {
        const result = await uploadFileToDrive(req.file.path, req.file.originalname);
        return res.status(200).json({
            success: true,
            fileId: result.id,
            fileName: result.name,
            link: result.webViewLink,
        });
    } catch (err) {
        // clean up temp file if drive upload failed
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(500).json({ success: false, error: err.message });
    }
});

//connection starting
connectDB();
app.listen(5000, () => {
    console.log('Server running on port 5000');
});