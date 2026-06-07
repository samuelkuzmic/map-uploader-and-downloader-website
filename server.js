const express = require('express');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

const DATA_FILE = path.join(__dirname, 'database_backup.json');
let fileDatabase = [];

// 1. Read existing files from GitHub storage on startup
if (fs.existsSync(DATA_FILE)) {
    try {
        fileDatabase = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        fileDatabase = [];
    }
}

// 2. Helper function that pushes updates permanently to GitHub
function syncWithGitHub(commitMessage) {
    try {
        // Save locally to the container first
        fs.writeFileSync(DATA_FILE, JSON.stringify(fileDatabase, null, 2));

        // Tell git who is making the change
        execSync('git config --global user.name "Cloud Bot"');
        execSync('git config --global user.email "bot@cloudstorage.com"');

        // Grab your secret API token from Render's environment variables
        const token = process.env.API_KEY;
        
        // Securely inject the token into the repository URL so we have permission to push changes
        const remoteUrl = execSync('git remote get-url origin').toString().trim();
        if (remoteUrl.includes('github.com')) {
            const authenticatedUrl = remoteUrl.replace('https://github.com/', `https://x-access-token:${token}@github.com/`);
            execSync(`git remote set-url origin "${authenticatedUrl}"`);
        }

        // Add, commit, and push the backup file to your GitHub history permanently
        execSync('git add database_backup.json');
        execSync(`git commit -m "${commitMessage}"`);
        execSync('git push origin main || execSync("git push origin master")');
        console.log("Successfully synced permanently to GitHub!");
    } catch (error) {
        console.error("GitHub Sync Warning:", error.message);
    }
}

// Route to GET all global files
app.get('/api/files', (req, res) => {
    res.json(fileDatabase);
});

// Route to POST and permanently save a new file
app.post('/api/files', (req, res) => {
    try {
        const { name, content, creator } = req.body;
        if (!name || !content) return res.status(400).json({ error: "Missing data" });

        const newFile = {
            _id: Math.random().toString(36).substr(2, 9),
            name: name,
            content: content,
            creator: creator,
            createdAt: new Date().toISOString()
        };

        fileDatabase.push(newFile);
        
        // Trigger GitHub sync
        syncWithGitHub(`Add file: ${name}`);
        
        res.json({ success: true, file: newFile });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SECURED: Route to DELETE a file (Checks the creator signature first)
app.delete('/api/files', (req, res) => {
    try {
        const fileId = req.query.id;
        const userSignature = req.headers['user-signature']; // Grabs the sender's secret ID

        if (!userSignature) {
            return res.status(401).json({ error: "Unauthorized: Missing user signature" });
        }

        const fileToDelete = fileDatabase.find(item => item._id === fileId);

        if (!fileToDelete) {
            return res.status(404).json({ error: "File not found" });
        }

        // SECURITY CHECK: Does the person deleting match the person who uploaded it?
        if (fileToDelete.creator !== userSignature) {
            return res.status(403).json({ error: "Unauthorized: You did not upload this file!" });
        }

        const fileName = fileToDelete.name;
        fileDatabase = fileDatabase.filter(item => item._id !== fileId);
        
        // Sync the removal with GitHub
        syncWithGitHub(`Deleted file: ${fileName}`);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Secure Server active on port ${PORT}`));