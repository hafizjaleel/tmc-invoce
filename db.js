const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || "mongodb+srv://hafizjaleel:Hafiz1335@cluster0.aidzi7y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function connectToMongoDB() {
    try {
        await client.connect();
        console.log("Connected to MongoDB Atlas");
        return client.db('invoice_db');
    } catch (error) {
        console.error("MongoDB Connection error:", error);
        await client.close();
        throw error;
    }
}

async function closeConnection() {
    try {
        await client.close();
        console.log("MongoDB connection closed");
    } catch (error) {
        console.error("Error closing MongoDB connection:", error);
        throw error;
    }
}

module.exports = { connectToMongoDB, closeConnection };
