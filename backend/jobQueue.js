const Queue = require("bull");
const Job = require("./Models/Job");
const { runInSandbox } = require("./sandboxRunner");

const jobQueue = new Queue("job-queue", {
    redis: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: 6379
    }
});
const NUM_WORKERS = 5;

jobQueue.process(NUM_WORKERS, async ({ data }) => {
    const { id: jobId } = data;
    const job = await Job.findById(jobId);

    if (job === null) {
        // FIXED: was (job === undefined) — Mongoose returns null for missing docs, not undefined
        throw new Error("Job not Found");
    }

    job.startedAt = new Date();

    try {
        job.output = await runInSandbox(job.filepath, job.language);
        job.status = "success";
    } catch (err) {
        job.output = err?.stderr || err?.message || String(err);
        job.status = "error";
    }
    job.completedAt = new Date();
    await job.save();

    return true;
});

jobQueue.on("failed", (job, err) => {
    console.error("Queue job failed:", job?.data?.id, err.message);
});

const addJobToQueue = async (jobId) => {

    await jobQueue.add({ id: jobId }, { removeOnComplete: true, removeOnFail: 100});    
};

module.exports = { addJobToQueue };