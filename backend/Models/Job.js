const mongoose = require('mongoose');

const JobSchema = mongoose.Schema({
    language: {
        type: String,
        enum: ["cpp", "python", "java", "c"],
        required: true
    },
    filepath: {
        type: String,
        required: true,
    },
    code: {               // ✅ ADDED: was missing from schema
        type: String,
        required: true,
    },
    submittedAt: {        // ✅ FIXED: was "sumbittedAt" (typo)
        type: Date,
        default: Date.now
    },
    startedAt: {
        type: Date
    },
    completedAt: {
        type: Date
    },
    output: {
        type: String
    },
    status: {
        type: String,
        default: "pending",
        enum: ["pending", "success", "error"]
    }
});

const Job = mongoose.model('job', JobSchema); // ✅ FIXED: was "new mongoose.model" (unnecessary new)

module.exports = Job;