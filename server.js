const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://hafizjaleel:Hafzi1335@cluster0.aidzi7y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            retryWrites: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('MongoDB connected successfully');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

// Initial connection
connectDB();

// Handle connection errors
mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err);
    connectDB();
});
