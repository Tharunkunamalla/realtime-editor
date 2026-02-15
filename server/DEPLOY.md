# Deployment Guide to Fix "Localhost" Error and WebSockets

The error you are seeing (`ws://localhost:5000...`) happens because the frontend doesn't know where the live backend is, so it defaults to localhost.

Current problem:
1.  **Frontend (Vercel)**: Trying to connect to `localhost`.
2.  **Backend (Vercel?)**: Vercel is a "Serverless" platform. It shuts down connections after 10 seconds. **Real-time WebSockets (Socket.io) will NOT work properly if hosted directly on Vercel functions.**

## Solution: Split Deployment

To make this work flawlessly, we need to host the Backend on a service that supports persistent connections (like **Render** or **Railway**) and keep the Frontend on Vercel.

### Step 1: Deploy Backend to Render (Free)
1.  Push your code to GitHub.
2.  Go to [dashboard.render.com](https://dashboard.render.com/).
3.  Click **New +** -> **Web Service**.
4.  Connect your GitHub repository.
5.  **Settings**:
    *   **Root Directory**: `server`
    *   **Build Command**: `npm install`
    *   **Start Command**: `node index.js`
6.  Click **Deploy**.
7.  Once live, copy the URL (e.g., `https://realtime-editor-api.onrender.com`).

### Step 2: Configure Frontend on Vercel
1.  Go to your project settings on **Vercel**.
2.  Navigate to **Settings** -> **Environment Variables**.
3.  Add a new variable:
    *   **Key**: `VITE_BACKEND_URL`
    *   **Value**: (The Render URL from Step 1, e.g., `https://realtime-editor-api.onrender.com`)
    *   *Note: Do not include a trailing slash `/`.*
4.  **Redeploy** the frontend (go to Deployments -> Redeploy) so it picks up the new variable.

### Step 3: Verify
Your Vercel app will now connect to the Render backend, and the "WebSocket connection failed" error will vanish.
