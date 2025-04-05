const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://hafizjaleel:Hafzi1335@cluster0.aidzi7y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            ssl: true,
            tlsAllowInvalidCertificates: true, // Only use in development
            retryWrites: true
        });
        console.log('MongoDB connected successfully');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        // Retry connection after 5 seconds
        setTimeout(connectDB, 5000);
    }
};

// Initial connection
connectDB();

// Handle connection errors
mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err);
    // Attempt to reconnect
    connectDB();
});
