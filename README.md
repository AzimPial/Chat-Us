# Private Chat App

A modern, private chat application built with React, Tailwind CSS, and Firebase.

## Setup Instructions

Since the automated setup could not be completed due to environment restrictions, please follow these steps manually:

1.  **Install Dependencies**:
    Open your terminal in this directory and run:
    ```bash
    npm install
    ```

2.  **Configure Firebase**:
    - Go to [Firebase Console](https://console.firebase.google.com/).
    - Create a new project.
    - Enable **Authentication** (Anonymous provider).
    - Enable **Firestore Database** (Create database in test mode).
    - Copy your web app configuration.
    - Open `src/firebase.js` and replace the placeholder `firebaseConfig` with your actual keys.

3.  **Run the App**:
    ```bash
    npm run dev
    ```

## Features
- **Anonymous Auth**: Auto-login with a unique Search Code (UID).
- **Profile**: Set your display name.
- **Friend System**: Search by UID, send requests, accept/reject.
- **Real-time Chat**: Private messaging with friends.
