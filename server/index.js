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

// Use a Set for O(1) lookups and uniqueness
const waitingQueue = new Set();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('find_partner', () => {
        // Ensure user isn't already in queue or matched
        if (waitingQueue.has(socket)) {
            return;
        }

        // Filter out disconnected sockets from queue just in case
        // (though disconnect handler should catch them)

        let partner = null;

        // Simple FIFO: Get the first available user who isn't self
        for (const user of waitingQueue) {
            if (user.id !== socket.id) {
                partner = user;
                break;
            }
        }

        if (partner) {
            // Remove partner from queue
            waitingQueue.delete(partner);

            // Match found
            // Notify both users
            socket.emit('partner_found', { initiator: true });
            partner.emit('partner_found', { initiator: false });

            // Store partner ID for signaling
            socket.partnerId = partner.id;
            partner.partnerId = socket.id;

            console.log(`Matched ${socket.id} with ${partner.id}`);
        } else {
            // No one waiting, add to queue
            waitingQueue.add(socket);
            console.log(`User ${socket.id} added to queue. Queue size: ${waitingQueue.size}`);
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

    socket.on('video_request', () => {
        if (socket.partnerId) {
            io.to(socket.partnerId).emit('video_request');
        }
    });

    socket.on('video_accepted', () => {
        if (socket.partnerId) {
            io.to(socket.partnerId).emit('video_accepted');
        }
    });

    socket.on('disconnect_call', () => {
        // Remove from queue if they were waiting
        if (waitingQueue.has(socket)) {
            waitingQueue.delete(socket);
        }

        if (socket.partnerId) {
            io.to(socket.partnerId).emit('partner_disconnected');
            const partnerSocket = io.sockets.sockets.get(socket.partnerId);
            if (partnerSocket) {
                partnerSocket.partnerId = null;
            }
            socket.partnerId = null;
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Remove from queue immediately
        if (waitingQueue.has(socket)) {
            waitingQueue.delete(socket);
            console.log(`User ${socket.id} removed from queue. Queue size: ${waitingQueue.size}`);
        }

        if (socket.partnerId) {
            io.to(socket.partnerId).emit('partner_disconnected');
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
