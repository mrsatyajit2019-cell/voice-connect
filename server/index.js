const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/dist')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity in dev
        methods: ["GET", "POST"]
    }
});

let waitingUser = null;

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('find_partner', () => {
        if (waitingUser) {
            // Match found
            const partner = waitingUser;
            waitingUser = null;

            // Notify both users
            socket.emit('partner_found', { initiator: true });
            partner.emit('partner_found', { initiator: false });

            // Store partner ID for signaling
            socket.partnerId = partner.id;
            partner.partnerId = socket.id;

            console.log(`Matched ${socket.id} with ${partner.id}`);
        } else {
            // No one waiting, add to queue
            waitingUser = socket;
            console.log(`User ${socket.id} waiting for partner`);
        }
    });

    socket.on('offer', (data) => {
        if (socket.partnerId) {
            io.to(socket.partnerId).emit('offer', data);
        }
    });

    socket.on('answer', (data) => {
        if (socket.partnerId) {
            io.to(socket.partnerId).emit('answer', data);
        }
    });

    socket.on('ice-candidate', (data) => {
        if (socket.partnerId) {
            io.to(socket.partnerId).emit('ice-candidate', data);
        }
    });

    socket.on('disconnect_call', () => {
        if (socket.partnerId) {
            io.to(socket.partnerId).emit('partner_disconnected');
            const partnerSocket = io.sockets.sockets.get(socket.partnerId);
            if (partnerSocket) {
                partnerSocket.partnerId = null;
            }
            socket.partnerId = null;
        }

        if (waitingUser === socket) {
            waitingUser = null;
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        if (waitingUser === socket) {
            waitingUser = null;
        }

        if (socket.partnerId) {
            io.to(socket.partnerId).emit('partner_disconnected');
            // Ideally, we should clear the partner's partnerId as well, 
            // but the client will handle the disconnect event and likely re-search or show a message.
            const partnerSocket = io.sockets.sockets.get(socket.partnerId);
            if (partnerSocket) {
                partnerSocket.partnerId = null;
            }
        }
    });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
