const express = require("express");
const cors = require("cors");
const mongoose = require('mongoose')

const { generateFile } = require('./generatefile');
const { executeCpp } = require('./executecpp');
const { executePython } = require('./executePython');
const { executeJava } = require('./executeJava');
const { executeC } = require('./executeC');
const Job = require("./Models/Job");

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/compilerapp');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
    console.log("Mongodb connected");
};

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/status", async(req, res) => {

    const jobId = req.query.id;

    if(jobId == undefined){
        return res.status(400).json({success: false, error: "missing id query param"})
    }
    try {
    const job = await new Job.findById(jobId);
    
    } catch(err) {
        return res.status(400).json({success: false, error: JSON.stringify(err)});
    }
});

app.post("/run", async (req, res) => {
    const { language = "cpp", code } = req.body;
    console.log(language, code ? code.length: 0)
    if (!code) {
        return res.status(400).json({ success: false, error: "Empty code body" });
    }

    let job;

    try {
        const filepath = await generateFile(language, code);

        job = await new Job({language, filepath, code}).save();
        const jobId = job["_id"];
        console.log(job);
        
        res.status(201).json({success: true, jobId});

        //const result = await executeCpp(filepath);
        let output;
        
        job ["startedAt"] = new Date();
        if (language === "cpp") {
            output = await executeCpp(filepath);
        }

        else if (language === "python") {
            output = await executePython(filepath);
        }

        else if (language === "java") {
            output = await executeJava(filepath);
        }

        else if (language === "c") {
            output = await executeC(filepath);
        }
        else {
            return res.status(400).json({ error: "Language not supported yet" });
        }
        
        job["completedAt"] = new Date();
        job["status"] = "success";
        job["output"] = output;

        await job.save();
        console.log(job);
        //job.output = output;
        //await job.save();
        
        /**return res.json({
            filepath,
            output: String(output)
        });**/

    } catch (err) {
        job["completedAt"] = new Date();
        job["status"] = "error";
        job["output"] = JSON.stringify(err);
        await job.save();
        console.error(job);
        /**return res.status(500).json({
            error: err.stderr || err.message
        });**/
    }
});

connectDB();

app.listen(5000, () => {
    console.log('Server running on port 5000');
});