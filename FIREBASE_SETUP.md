# Firebase Setup for Havenvoy Leaderboard

This guide will walk you through setting up Firebase Realtime Database for the global leaderboard feature.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" (or "Add project")
3. Enter a project name (e.g., "havenvoy-leaderboard")
4. You can disable Google Analytics (not needed for leaderboard)
5. Click "Create project"

## Step 2: Create a Realtime Database

1. In your Firebase project, click "Build" in the left sidebar
2. Select "Realtime Database"
3. Click "Create Database"
4. Choose a location (pick the one closest to your players)
5. Start in **test mode** for now (we'll add proper rules later)
6. Click "Enable"

## Step 3: Get Your Firebase Config

1. Click the gear icon next to "Project Overview" in the left sidebar
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon (`</>`) to add a web app
5. Enter a nickname (e.g., "Havenvoy Web")
6. Don't check "Firebase Hosting" (unless you want to host there)
7. Click "Register app"
8. You'll see your Firebase config object - copy it!

## Step 4: Update Your Config

Open `js/leaderboard.js` and replace the placeholder config with your actual values:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_ACTUAL_API_KEY",
    authDomain: "your-project-id.firebaseapp.com",
    databaseURL: "https://your-project-id-default-rtdb.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abc123def456"
};
```

## Step 5: Set Database Rules

For a public leaderboard with basic security, go to "Realtime Database" > "Rules" tab and use these rules:

```json
{
  "rules": {
    "leaderboard": {
      "$category": {
        ".read": true,
        ".write": true,
        ".indexOn": ["score"]
      }
    }
  }
}
```

**Note:** These rules allow anyone to read and write to the leaderboard. For a production game, you should add:
- Rate limiting via Cloud Functions
- Score validation on the server side
- User authentication

## Step 6: Test Your Leaderboard

1. Open your game in a browser
2. Click the "Leaderboard" button in the menu
3. Enter your name and click "Set Name"
4. Play the game to build up some stats
5. Click "Submit Scores" to upload your scores

If you see your scores appear, the setup is complete!

## Troubleshooting

### "Leaderboard not configured" error
- Make sure you replaced all the placeholder values in `firebaseConfig`
- Check that your `databaseURL` is correct (it should end with `.firebaseio.com`)

### Scores not appearing
- Check browser console for errors
- Make sure your database rules allow read/write access
- Verify your Firebase project is on the free Spark plan or Blaze plan

### "Permission denied" error
- Go to Realtime Database > Rules and make sure your rules allow access
- For testing, you can temporarily use `".read": true, ".write": true`

## Security Considerations

For a public game, consider these additional security measures:

1. **Rate Limiting**: Use Firebase Cloud Functions to limit how often players can submit scores
2. **Score Validation**: Validate scores server-side to prevent cheating
3. **User Authentication**: Require players to sign in (Firebase Auth supports anonymous auth)
4. **IP Blocking**: Monitor for abuse and block problematic IPs

## Cost

Firebase's free Spark plan includes:
- 1 GB storage
- 10 GB/month download
- 100 simultaneous connections

This is plenty for a small to medium game. Monitor your usage in the Firebase Console.
