const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    // Stores the username to display the user's initial in the navbar (e.g., "P" for Payal)
    username: { type: String, required: true }, 
    
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    
    // Persistent records for the top-row boxes that remain visible even after days away
    lifetimeSteps: { type: Number, default: 0 },
    lifetimeEnergy: { type: Number, default: 0 },
    
    // Stores session data. 
    // Logic in server.js will ensure sessions from the same date are merged into one entry
    // to prevent duplicate bars for the same day.
    history: [{
        date: { type: Date, default: Date.now },
        steps: { type: Number, default: 0 },
        energy: { type: Number, default: 0 }
    }]
});

module.exports = mongoose.model('User', UserSchema);