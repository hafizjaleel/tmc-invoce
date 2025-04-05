const express = require('express');
const path = require('path');
const { connectToMongoDB } = require('./db');

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Default route - serve homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'homepage.html'));
});

// Serve invoice creation page
app.get('/create-invoice', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'generate.html'));
});

// API endpoints
app.post('/api/invoices', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const result = await db.collection('invoices').insertOne(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/invoices', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const invoices = await db.collection('invoices').find({}).toArray();
        res.json(invoices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Search invoices endpoint
app.get('/api/invoices/search', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const { invoiceNumber, clientName } = req.query;
        
        let query = {};
        if (invoiceNumber) {
            query.invoiceNumber = invoiceNumber;
        }
        if (clientName) {
            query.clientName = new RegExp(clientName, 'i');
        }
        
        const invoices = await db.collection('invoices').find(query).toArray();
        res.json(invoices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get recent invoices endpoint
app.get('/api/invoices/recent', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const recentInvoices = await db.collection('invoices')
            .find({})
            .sort({ _id: -1 })
            .limit(10)
            .toArray();
        res.json(recentInvoices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single invoice endpoint
app.get('/api/invoices/:id', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const { ObjectId } = require('mongodb');
        const invoice = await db.collection('invoices').findOne({ _id: new ObjectId(req.params.id) });
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.json(invoice);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete invoice endpoint
app.delete('/api/invoices/:id', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const { ObjectId } = require('mongodb');
        const result = await db.collection('invoices').deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update invoice endpoint
app.put('/api/invoices/:id', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const { ObjectId } = require('mongodb');
        const result = await db.collection('invoices').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: req.body }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function startServer() {
  try {
    await connectToMongoDB();
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
