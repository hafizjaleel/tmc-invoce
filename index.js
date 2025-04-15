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

// Check for duplicate invoice numbers
app.get('/api/invoices/check/:invoiceNumber', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const invoice = await db.collection('invoices').findOne({ 
            invoiceNumber: req.params.invoiceNumber 
        });
        res.json({ exists: !!invoice });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/invoices', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const { ObjectId } = require('mongodb');
        
        // Extract client ID from the name
        const client = await db.collection('clients').findOne({ name: req.body.clientName });
        if (!client) {
            throw new Error('Client not found');
        }

        const totalAmount = parseFloat(req.body.amountDue || req.body.totalAmount);
        const invoiceData = {
            ...req.body,
            clientId: client._id,
            totalAmount: totalAmount,
            issueDate: new Date(req.body.issueDate)
        };
        
        const result = await db.collection('invoices').insertOne(invoiceData);
        
        // Create single ledger entry for invoice
        const ledgerEntry = {
            date: invoiceData.issueDate,
            clientId: client._id,
            clientName: client.name, // Store client name directly
            description: `Sales(Invoice #${invoiceData.invoiceNumber})`,
            debit: totalAmount,
            credit: 0,
            invoiceNumber: invoiceData.invoiceNumber,
            timestamp: new Date()
        };
        
        await db.collection('ledger').insertOne(ledgerEntry);
        res.json(result);
    } catch (error) {
        console.error('Error creating invoice:', error);
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
        const { invoiceNumber, clientName, startDate, endDate } = req.query;
        
        let query = {};
        if (invoiceNumber) {
            query.invoiceNumber = invoiceNumber;
        }
        if (clientName) {
            query.clientName = new RegExp(clientName, 'i');
        }
        if (startDate || endDate) {
            query.issueDate = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                query.issueDate.$gte = start.toISOString();
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.issueDate.$lte = end.toISOString();
            }
        }

        console.log('Query:', query); // For debugging

        const invoices = await db.collection('invoices')
            .find(query)
            .sort({ issueDate: -1 })
            .toArray();

        console.log('Found invoices:', invoices.length); // For debugging
        res.json(invoices);
    } catch (error) {
        console.error('Search error:', error);
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

// Get invoice by ID endpoint
app.get('/api/invoices/:id', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const { ObjectId } = require('mongodb');
        let query;
        
        // Check if the id is an ObjectId or invoice number
        if (ObjectId.isValid(req.params.id)) {
            query = { _id: new ObjectId(req.params.id) };
        } else {
            query = { invoiceNumber: req.params.id };
        }
        
        const invoice = await db.collection('invoices').findOne(query);
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
        
        // First find the invoice to get its number
        const invoice = await db.collection('invoices').findOne({ _id: new ObjectId(req.params.id) });
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        // Delete the invoice
        const result = await db.collection('invoices').deleteOne({ _id: new ObjectId(req.params.id) });
        
        // Delete corresponding ledger entry
        await db.collection('ledger').deleteOne({ 
            invoiceNumber: invoice.invoiceNumber,
            description: `Sales(Invoice #${invoice.invoiceNumber})`
        });

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

        // Get the existing invoice
        const existingInvoice = await db.collection('invoices').findOne({ _id: new ObjectId(req.params.id) });
        if (!existingInvoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        // Update the invoice including services array
        const result = await db.collection('invoices').updateOne(
            { _id: new ObjectId(req.params.id) },
            { 
                $set: {
                    ...req.body,
                    services: req.body.services || [],
                    totalAmount: parseFloat(req.body.amountDue || req.body.totalAmount),
                    updatedAt: new Date()
                }
            }
        );

        // Update corresponding ledger entry
        await db.collection('ledger').updateOne(
            { 
                invoiceNumber: existingInvoice.invoiceNumber,
                description: `Sales(Invoice #${existingInvoice.invoiceNumber})`
            },
            { 
                $set: {
                    debit: parseFloat(req.body.amountDue || req.body.totalAmount),
                    date: new Date(req.body.issueDate),
                    clientName: req.body.clientName,
                    updatedAt: new Date()
                }
            }
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add ledger entry endpoint
app.post('/api/ledger/entry', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const { ObjectId } = require('mongodb');
        
        const entry = {
            ...req.body,
            clientId: new ObjectId(req.body.clientId),
            timestamp: new Date(),
            date: new Date(req.body.date)
        };
        
        const result = await db.collection('ledger').insertOne(entry);
        res.json(result);
    } catch (error) {
        console.error('Error adding ledger entry:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update ledger entry endpoint
app.put('/api/ledger/entry/:id', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const { ObjectId } = require('mongodb');
        
        const entry = {
            ...req.body,
            clientId: new ObjectId(req.body.clientId),
            date: new Date(req.body.date),
            updatedAt: new Date()
        };
        
        const result = await db.collection('ledger').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: entry }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating ledger entry:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete ledger entry endpoint
app.delete('/api/ledger/entry/:id', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const { ObjectId } = require('mongodb');
        
        const result = await db.collection('ledger').deleteOne(
            { _id: new ObjectId(req.params.id) }
        );
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting ledger entry:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get ledger entries endpoint
app.get('/api/ledger', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const { ObjectId } = require('mongodb');
        const { clientId, startDate, endDate } = req.query;

        let matchQuery = {};
        if (clientId && clientId !== '') {
            matchQuery.clientId = new ObjectId(clientId);
        }
        if (startDate) {
            matchQuery.date = matchQuery.date || {};
            matchQuery.date.$gte = new Date(startDate);
        }
        if (endDate) {
            matchQuery.date = matchQuery.date || {};
            matchQuery.date.$lte = new Date(endDate);
        }

        const entries = await db.collection('ledger')
            .aggregate([
                { $match: matchQuery },
                {
                    $lookup: {
                        from: 'clients',
                        localField: 'clientId',
                        foreignField: '_id',
                        as: 'clientInfo'
                    }
                },
                { $unwind: { path: '$clientInfo', preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        date: 1,
                        clientName: { $ifNull: ['$clientName', '$clientInfo.name'] },
                        description: 1,
                        debit: 1,
                        credit: 1,
                        invoiceNumber: 1
                    }
                },
                { $sort: { date: -1, timestamp: -1 } }
            ]).toArray();

        res.json(entries);
    } catch (error) {
        console.error('Ledger error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Client management endpoints
app.post('/api/clients', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const result = await db.collection('clients').insertOne({
            name: req.body.name,
            address: req.body.address,
            createdAt: new Date()
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/clients', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const clients = await db.collection('clients')
            .find({})
            .sort({ name: 1 })
            .toArray();
        res.json(clients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/clients/:id', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const { ObjectId } = require('mongodb');
        const result = await db.collection('clients').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: {
                name: req.body.name,
                address: req.body.address,
                updatedAt: new Date()
            }}
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/clients/:id', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const { ObjectId } = require('mongodb');
        const result = await db.collection('clients').deleteOne(
            { _id: new ObjectId(req.params.id) }
        );
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Service management endpoints
app.post('/api/services', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const result = await db.collection('services').insertOne({
            name: req.body.name,
            rate: parseFloat(req.body.rate),
            createdAt: new Date()
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/services', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const services = await db.collection('services')
            .find({})
            .sort({ name: 1 })
            .toArray();
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/services/:id', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const { ObjectId } = require('mongodb');
        const result = await db.collection('services').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: {
                name: req.body.name,
                rate: parseFloat(req.body.rate),
                updatedAt: new Date()
            }}
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/services/:id', async (req, res) => {
    try {
        const db = await connectToMongoDB();
        const { ObjectId } = require('mongodb');
        const result = await db.collection('services').deleteOne(
            { _id: new ObjectId(req.params.id) }
        );
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add route for services page
app.get('/services', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'services.html'));
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
