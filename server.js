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

        // Configure the remote URL to use your permanent Key for secure write access
        // Assumes your Render environment variable 'API_KEY' is set to your token
        const token = process.env.API_KEY;
        
        // This securely grabs your current repository details to push back to it
        const remoteUrl = execSync('git remote get-url origin').toString().trim();
        if (remoteUrl.includes('github.com')) {
            const authenticatedUrl = remoteUrl.replace('https://github.com/', `https://x-access-token:${token}@github.com/`);
            execSync(`git remote set-url origin "${authenticatedUrl}"`);
        }

        // Add, commit, and push the backup file to your GitHub history permanently
        execSync('git add database_backup.json');
        execSync(`git commit -m "${commitMessage}"`);
        execSync('git push origin main || git push origin master');
        console.log("Successfully synced permanently to GitHub!");
    } catch (error) {
        console.error("GitHub Sync Warning (will retry next upload):", error.message);
    }
}

// Route to GET files
app.get('/api/files', (req, res) => {
    res.json(fileDatabase);
});

// Route to POST and save via GitHub commit
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
        
        // Save and trigger the permanent GitHub sync
        syncWithGitHub(`Add file: ${name}`);
        
        res.json({ success: true, file: newFile });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to DELETE and update GitHub history
app.delete('/api/files', (req, res) => {
    const fileId = req.query.id;
    const fileToDelete = fileDatabase.find(item => item._id === fileId);
    const fileName = fileToDelete ? fileToDelete.name : 'Unknown';

    fileDatabase = fileDatabase.filter(item => item._id !== fileId);
    
    // Save and trigger the permanent GitHub sync removal
    syncWithGitHub(`Deleted file: ${fileName}`);
    
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Permanent GitHub-Backed Server active on port ${PORT}`));