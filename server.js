const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const User = require('./models/User'); 

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// --- STATIC FOLDERS ---
// 1. Standard public folder for assets
app.use(express.static(path.join(__dirname, 'public')));

// 2. FIXED: Unlock the main folder so the video file is accessible to the browser
app.use(express.static(__dirname)); 

// --- SESSION CONFIGURATION ---
app.use(session({
    secret: 'regenx_kinetic_secret_77',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));

// 1. DB CONNECTION
mongoose.connect('mongodb://localhost:27017/ReGenX_Project')
    .then(() => console.log('⚡ Grid Database Connected'))
    .catch(err => console.error('DB Error:', err));

// 2. NAVIGATION ROUTES
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html'))); 
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'auth.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/signup');
});

// --- USER API: Returns full records including aggregated history ---
app.get('/api/user', async (req, res) => {
    if (req.session.user) {
        try {
            const user = await User.findById(req.session.user.id);
            res.json(user);
        } catch (err) {
            res.status(500).json({ error: "Failed to fetch user data" });
        }
    } else {
        res.json(null);
    }
});

// 3. AUTHENTICATION APIS
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(409).json({ error: "Email already registered" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();
        
        req.session.user = { id: newUser._id, username: newUser.username, email: newUser.email };
        res.status(201).json({ message: "Success" });
    } catch (error) {
        res.status(400).json({ error: "Invalid Data" });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = { id: user._id, username: user.username, email: user.email };
            return res.status(200).json({ message: "Login success" });
        }
        res.status(401).json({ error: "Invalid credentials" });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// --- SAVE SESSION API: Merges sessions from the same day for clean Bar Graphs ---
app.post('/api/save-session', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });

    try {
        const { steps, energy } = req.body;
        const user = await User.findById(req.session.user.id);
        
        if (user) {
            user.lifetimeSteps += steps;
            user.lifetimeEnergy += energy;
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const dayIndex = user.history.findIndex(h => {
                const recordDate = new Date(h.date);
                recordDate.setHours(0, 0, 0, 0);
                return recordDate.getTime() === today.getTime();
            });

            if (dayIndex > -1) {
                user.history[dayIndex].steps += steps;
                user.history[dayIndex].energy += energy;
            } else {
                user.history.push({
                    date: new Date(),
                    steps: steps,
                    energy: energy
                });
            }

            await user.save();
            res.status(200).json({ message: "Session Saved and Merged" });
        }
    } catch (error) {
        console.error("Save Error:", error);
        res.status(500).json({ error: "Failed to save data" });
    }
});

// 4. THE LIVE HUB
io.on('connection', (socket) => {
    socket.on('step-pulse', (data) => {
        io.emit('update-ui', data); 
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`🚀 ReGenX active: http://localhost:${PORT}`));