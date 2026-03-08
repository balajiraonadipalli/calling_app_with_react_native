# AI Tutor Call Assistant

A production-ready React Native tutoring application that allows students and tutors to conduct academic calls, powered by **Firebase** and **WebRTC**. When a call ends, the audio is uploaded to Firebase Cloud Storage, which automatically triggers a Serverless Cloud Function that tasks OpenAI Whisper to transcribe the recording and GPT-4 to generate summaries, identify student doubts, and provide clarifications—all viewable on an elegant, modern UI.

## Tech Stack
- **Frontend**: React Native (JavaScript, React Navigation, Expo AV, React Native WebRTC)
- **Backend**: 100% Serverless (Google Firebase)
- **Services**: Firebase Auth, Firebase Firestore, Firebase Cloud Storage, Firebase Cloud Functions
- **AI Analytics**: OpenAI (Whisper, GPT-4)

---

## 📂 Project Structure

\`\`\` text
Callingapp/
├── backend/
│   ├── functions/        # Firebase Cloud Functions (Serverless Node)
│   │   ├── index.js      # OpenAI Whisper & GPT-4 Analysis Hook
│   │   └── package.json  
│   └── .firebaserc       # Firebase CLI targets
│
└── frontend/
    ├── assets/           # Images, fonts
    ├── components/       # Reusable UI components
    ├── config/           # Firebase SDK initialization
    ├── context/          # Firebase Auth context and global state
    ├── navigation/       # Stack Navigators
    ├── screens/          # App screens (Login, Dashboard, Call, SessionDetails)
    ├── App.js            # Entry point for React Native 
    ├── babel.config.js   
    ├── package.json      
    └── .env              # Expo Public API Keys
\`\`\`

---

## 🚀 Setup Instructions (Step-by-Step)

### 1. Firebase Project Setup
1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Enable the following services:
   - **Authentication**: Enable Email/Password sign-up.
   - **Firestore Database**: Create an empty database in test mode (or configure secure rules).
   - **Storage**: Create a default Cloud Storage bucket.

### 2. Frontend Setup
1. Open a terminal and navigate to the frontend directory:
   \`\`\`bash
   cd Callingapp/frontend
   \`\`\`
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Create a \`.env\` file in the \`frontend\` folder:
   \`\`\`bash
   EXPO_PUBLIC_FIREBASE_API_KEY="your-api-key"
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
   EXPO_PUBLIC_FIREBASE_PROJECT_ID="your-app-id"
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="your-app.firebasestorage.app"
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="sender-id"
   EXPO_PUBLIC_FIREBASE_APP_ID="app-id"
   EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID="G-xxxxxx"
   \`\`\`
    *(You can find these keys in your Firebase Console under Project Settings > Web App)*
4. Start the app via Expo:
   \`\`\`bash
   npx expo start
   \`\`\`

### 3. Serverless Backend Setup (Cloud Functions)
1. Ensure you have the Firebase CLI installed globally:
   \`\`\`bash
   npm install -g firebase-tools
   \`\`\`
2. Authenticate your terminal:
   \`\`\`bash
   firebase login
   \`\`\`
3. Navigate to your backend directory and link your project:
   \`\`\`bash
   cd Callingapp/backend
   firebase use --add
   \`\`\`
   *(Select the project you just created in the console)*
4. Set your secure OpenAI API key in the Cloud Environment:
   \`\`\`bash
   firebase functions:config:set openai.key="YOUR_OPENAI_API_KEY"
   \`\`\`
5. Deploy the Cloud Function:
   \`\`\`bash
   cd functions
   npm install
   firebase deploy --only functions
   \`\`\`

---

## 🔒 Important Security Considerations
For a production environment, ensure the following measures are in place:

1. **Firestore Rules**: Ensure your Firestore `users` and `sessions` collections are properly secured via Firebase Rules so users can only read/write documents they logically own.
2. **Storage Rules**: Add Firebase Storage rules to ensure only authenticated users can drop `.m4a` files into the `sessions/` directory.
3. **Environment Variables**: Never commit your `.env` file or OpenAI keys to version control. Add `.env` to `.gitignore`.
4. **Recording Privacy**: Student data is highly sensitive. Ensure your OpenAI data agreement guarantees zero-data-retention training if processing underage minors.
