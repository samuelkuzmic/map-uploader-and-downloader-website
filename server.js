const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const app = express();

app.use(express.json());
// Serves your index.html file automatically
app.use(express.static(path.join(__dirname)));

// Get your actual Connection String from Atlas (Database -> Connect -> Drivers)
const MONGO_URI = process.env.MONGO_URI || "your_fallback_mongodb_connection_string_here";
let db;

MongoClient.connect(MONGO_URI)
    .then(client => {
        db = client.db('FileSharingApp'); // Database Name
        console.log("Connected securely to MongoDB!");
    })
    .catch(err => console.error("MongoDB Connection Error:", err));

// Route to GET all files
app.get('/api/files', async (req, res) => {
    try {
        const files = await db.collection('files').find().toArray();
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to POST a new file
app.post('/api/files', async (req, res) => {
    try {
        const result = await db.collection('files').insertOne(req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to DELETE a file
app.delete('/api/files', async (req, res) => {
    try {
        const result = await db.collection('files').deleteOne({ _id: new ObjectId(req.query.id) });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));