// models/pressban.js
const mongoose = require('mongoose');

const pressBanSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    moderatorId: { type: String, required: true },
    moderatorName: { type: String, required: true },
    reason: { type: String, required: true },
    date: { type: Date, default: Date.now },
    uniqueToken: { type: String, required: true },
    duration: { type: Number, default: null } // Duration in milliseconds
});

module.exports = mongoose.model('PressBan', pressBanSchema);
