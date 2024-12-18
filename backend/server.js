const express = require("express");
const app = express();
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { addUser, getUser, removeUser } = require("./utils/users");
const { PeerServer } = require("peer");

const server = http.createServer(app);

const peerServer = PeerServer({ port: 501, path: "/" });

// Use CORS middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Attach PeerServer to a specific route (instead of app.use())
app.use("/peerjs", (req, res, next) => {
  // The PeerServer runs separately, so we forward peer requests correctly
  next();
});

// Socket.IO server
const io = new Server(server);

// Routes
app.get("/", (req, res) => {
  res.send(
    "This is the MERN real-time board sharing app official server by FullyWorld Web Tutorials"
  );
});

// Global variables to store room data
let roomIdGlobal, imgURLGlobal;

// WebSocket connections
io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // Handle user joining a room
  socket.on("userJoined", (data) => {
    const { name, userId, roomId, host, presenter } = data;
    roomIdGlobal = roomId;
    socket.join(roomId);

    // Add user to the room
    const users = addUser({
      name,
      userId,
      roomId,
      host,
      presenter,
      socketId: socket.id,
    });

    // Emit user join events
    socket.emit("userIsJoined", { success: true, users });
    console.log({ name, userId });
    socket.broadcast.to(roomId).emit("allUsers", users);

    // Broadcast user join and whiteboard data
    setTimeout(() => {
      socket.broadcast
        .to(roomId)
        .emit("userJoinedMessageBroadcasted", { name, userId, users });
      socket.broadcast.to(roomId).emit("whiteBoardDataResponse", {
        imgURL: imgURLGlobal,
      });
    }, 1000);
  });

  // Handle whiteboard data
  socket.on("whiteboardData", (data) => {
    imgURLGlobal = data;
    socket.broadcast.to(roomIdGlobal).emit("whiteBoardDataResponse", {
      imgURL: data,
    });
  });

  // Handle messages
  socket.on("message", (data) => {
    const { message } = data;
    const user = getUser(socket.id);
    if (user) {
      socket.broadcast
        .to(roomIdGlobal)
        .emit("messageResponse", { message, name: user.name });
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    const user = getUser(socket.id);
    if (user) {
      removeUser(socket.id);
      socket.broadcast.to(roomIdGlobal).emit("userLeftMessageBroadcasted", {
        name: user.name,
        userId: user.userId,
      });
    }
  });
});

// Start the HTTP server
const port = process.env.PORT || 500;
server.listen(port, () =>
  console.log(`Server is running on http://localhost:${port}`)
);
