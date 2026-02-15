# Real-Time Code Collaboration Platform - Project Overview

## 1. Project Description
**Project Name:** Real-Time Code Editor (CodeSync)
**Type:** Full-Stack Web Application (MERN Stack + Socket.io)

This project is a real-time collaborative code editor that allows multiple users to join a shared "room" and write code together simultaneously. It functions similarly to tools like Google Docs but is specialized for programming. Users can see each other's changes and cursor positions in real-time, change languages, and execute code directly within the browser using an external compilation API.

Key Features:
- **Instant Room Creation:** Generate a unique room ID to invite others.
- **Real-Time Collaboration:** Code changes are synchronized instantly across all connected clients.
- **Live Cursor Tracking:** See exactly where other users are typing with color-coded cursors and name labels.
- **Multi-Language Support:** accurate syntax highlighting for JavaScript, Python, Java, C#, etc.
- **Code Execution:** Run code directly in the browser and see the output (powered by Piston API).
- **Persistence:** Code state is saved to a MongoDB database, ensuring work isn't lost if all users disconnect.

---

## 2. Technology Stack

### Frontend (Client)
- **Framework:** React.js (Vite)
- **Language:** JavaScript
- **Styling:** CSS3 (Custom responsive design with a dark/neon aesthetic)
- **Code Editor Component:** Monaco Editor (`@monaco-editor/react`) - The core editor engine used in VS Code.
- **Real-Time Communication:** `socket.io-client`
- **Routing:** `react-router-dom`
- **Utilities:** `react-hot-toast` (notifications), `uuid` (unique IDs), `react-avatar`.

### Backend (Server)
- **Runtime:** Node.js
- **Framework:** Express.js
- **Real-Time Engine:** `socket.io`
- **Database:** MongoDB (using Mongoose ODM)
- **Utilities:** `cors` (Cross-Origin Resource Sharing), `dotenv` (Environment variables).

### External APIs
- **Piston API:** Used for executing user code safely in a sandboxed environment (`https://emkc.org/api/v2/piston`).

---

## 3. Connection Architecture

The application uses a **Client-Server architecture** with bidirectional communication channels established via WebSockets.

1.  **Initiation:**
    - The client sends an HTTP handshake request to the server.
    - If successful, the connection upgrades to a persistent **WebSocket** connection.
    - If WebSockets fail (e.g., due to firewall), it falls back to **HTTP Long-Polling**.

2.  **Room Logic:**
    - Socket.io's "Rooms" feature is used to isolate groups of users.
    - When a user joins, their socket ID is mapped to their username in memory (`userSocketMap`).
    - Events (like typing code) are broadcast *only* to other sockets in the same `roomId`.

3.  **Data Flow:**
    - **Code Changes:** Client A types -> `CODE_CHANGE` event -> Server -> Broadcast to Room -> Client B, C updates editor.
    - **Cursor Moves:** Client A moves cursor -> `CURSOR_CHANGE` event -> Server -> Broadcast to Room -> Client B, C displays "Client A" label at new coordinates.

---

## 4. WebSocket Limits & Crash Scenarios

Socket.IO is robust, but like any technology, it has limits based on the underlying infrastructure:

### Connection Limits (Concurrency)
- **Crash Point:** A single Node.js process can typically handle **10k - 50k concurrent connections** depending on server RAM and CPU.
- **Bottle Neck:** The OS file descriptor limit (usually defaults to 1024 or 4096) is often the first limit hit. This must be increased (`ulimit -n 65535`) on the server for high scale.
- **WebSocket Payload:** Default max payload size is **1MB**. Sending huge text blocks (like pasting a 5MB log file) will disconnect the socket.

### Connection Stability
- **Heartbeats:** The server sends a "ping" every 25 seconds (default). If the client doesn't "pong" back within the `pingTimeout` (60s), the connection is closed.
- **Reconnection:** The client is configured to retry `Infinity` times if disconnected.

### Common Failure Points
1.  **Memory Leaks:** If `userSocketMap` grows indefinitely without cleanup (e.g., proper disconnect handling), the server will run out of RAM and crash.
2.  **Event Loop Blocking:** If the server performs heavy synchronous computations (like complex regex on code), it blocks the event loop, causing all other sockets to timeout and disconnect. That is why code execution is offloaded to the external Piston API.

---

## 5. File-by-File Explanation

### **Client Side (`client/src/`)**

#### `main.jsx` & `App.jsx`
- **Role:** Entry point. Sets up the React Router (`BrowserRouter`) and defines routes (`/` for Home, `/editor/:roomId` for EditorPage).

#### `socket.js`
- **Role:** Singleton Socket Initializer.
- **What it says:** "Create a single shared socket connection instance using the backend URL. Use WebSocket transport first, but allow polling as backup. Retry forever if disconnected."

#### `pages/Home.jsx`
- **Role:** Landing Page.
- **Function:**
    - Generates a unique Room ID using `uuid`.
    - Collects user inputs (Room ID, Username).
    - Redirects user to the Editor page via `useNavigate` with state.

#### `pages/EditorPage.jsx`
- **Role:** The "Brain" of the frontend.
- **Function:**
    - **Socket Lifecycle:** Connects on mount, disconnects on unmount.
    - **Event Listeners:** Listens for `JOINED`, `DISCONNECTED`, `CODE_CHANGE`, `LANGUAGE_CHANGE`.
    - **Error Handling:** Manages connection errors and loading states.
    - **Layout:** Orchestrates the Client List (Sidebar), Editor, and Output components.

#### `components/Editor.jsx`
- **Role:** Text Editing Surface.
- **Function:**
    - Wraps the `MonacoEditor` component.
    - **Emitting:** Detects typing (`onDidChangeModelContent`) and emits `CODE_CHANGE`. Detects cursor movement and emits `CURSOR_CHANGE`.
    - **Receiving:** Updates the text content when remote data arrives (locks `isRemoteUpdate` flag to prevent loops).
    - **Cursors:** Renders "Decorations" (CSS markers) for remote users' cursors.

#### `components/Client.jsx`
- **Role:** Avatar Display.
- **Function:** Renders a user's initials/avatar in the sidebar using `react-avatar`.

#### `components/Output.jsx`
- **Role:** Code Runner.
- **Function:**
    - Takes current code and language.
    - Sends a POST request to `https://emkc.org/api/v2/piston/execute`.
    - Displays `stdout` (logs) or `stderr` (errors) in a terminal-like box.

#### `Actions.js`
- **Role:** Constants.
- **Function:** A dictionary of event strings (e.g., `'join'`, `'code-change'`) shared between client and server to prevent typo bugs. (Currently duplicated in client/server folders; ideally should be a shared package).

---

### **Server Side (`server/`)**

#### `index.js`
- **Role:** The Backend Server.
- **Function:**
    - **Setup:** Initializes Express app, HTTP server, and Socket.io server with CORS.
    - **Database:** Connects to MongoDB to persist room data.
    - **Events:**
        - `JOIN`: Adds socket to room. Checks DB for existing code (persistence).
        - `CODE_CHANGE`: Broadcasts code to others. **Debounces** database writes (saves to DB only once every 1s of inactivity to save resources).
        - `SYNC_CODE`: Sends current code to a newly joined user.
        - `disconnecting`: Notifies others that a user is leaving.

#### `models/Room.js`
- **Role:** Database Schema.
- **Function:** Defines the MongoDB document structure: `roomId`, `code`, and `language`.

#### `Actions.js`
- **Role:** Constants.
- **Function:** Mirror of the client-side file. Defines the event names used for socket communication.
