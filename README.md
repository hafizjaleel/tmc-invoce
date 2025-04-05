# TMC Invoice Project

## Setup

1. Install dependencies:
```bash
npm install
npm install -g nodemon
```

2. Environment Setup:
- Create a `.env` file in the root directory
- Add your MongoDB connection string and port:
```
MONGODB_URI=your_mongodb_connection_string
PORT=3000
```

## Running the Application

1. Development mode with auto-reload:
```bash
npm run dev
```

2. Production mode:
```bash
npm start
```

3. The application should now be running on your configured port (default: 3000)
```bash
http://localhost:3000
```

## Testing
Visit http://localhost:3000 to verify the API is running.
