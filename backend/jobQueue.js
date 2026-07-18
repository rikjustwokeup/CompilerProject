const Queue = require("bull");
const jobQueue = new Queue('job-queue');
const NUM_WORKERS = 5;
const Job = require('./Models/Job');
const { executeCpp } = require('./executecpp');
const { executePython } = require('./executePython');
const { executeJava } = require('./executeJava');
const { executeC } = require('./executeC');

jobQueue.process(NUM_WORKERS, async ({ data }) => {
    console.log(data);
    const { id: jobId } = data;
    const job = await Job.findById(jobId);

    if (job === null) {
        // ✅ FIXED: was (job === undefined) — Mongoose returns null for missing docs, not undefined
        throw new Error("Job not Found");
    }

    console.log("Fetched Job", job);

    try {
        job["startedAt"] = new Date();

        let output; // ✅ FIXED: was undeclared (implicit global variable)

        if (job.language === "cpp") {
            output = await executeCpp(job.filepath);
        } else if (job.language === "python") {
            output = await executePython(job.filepath);
        } else if (job.language === "java") {
            output = await executeJava(job.filepath);
        } else if (job.language === "c") {
            output = await executeC(job.filepath);
        } else {
            throw new Error("Language not supported yet");
            // ✅ FIXED: was res.status(400).json(...) — res doesn't exist in queue worker scope
        }

        job["completedAt"] = new Date();
        job["status"] = "success";
        job["output"] = output;
        await job.save();

    } catch (err) {
        job["completedAt"] = new Date();
        job["status"] = "error";
        job["output"] = err?.stderr || err?.message || JSON.stringify(err);
        await job.save();
        console.error(job);
    }

    return true;
});

jobQueue.on('failed', (error) => {
    console.log(error.data.id, "failed", error.failedReason);
});

const addJobToQueue = async (jobId) => {
    await jobQueue.add({ id: jobId });
};

module.exports = {
    addJobToQueue
};