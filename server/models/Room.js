const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    users: [{ type: String }], // Store usernames or socket IDs
    code: { type: String, default: '// Write your code here' },
    language: { type: String, default: 'javascript' },
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);


