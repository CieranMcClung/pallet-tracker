// Firebase service: initializes connection and provides database/storage instances.

let db, storage, auth, templatesCollection, tasksCollection; // Added auth

try {
    if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') {
        throw new Error("Firebase library or config is not defined. Load firebase-app-compat.js and firebase-config.js first.");
    }

    if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase app initialized.");
    } else {
        // console.log("Firebase app already initialized.");
    }
    
    db = firebase.firestore();
    storage = firebase.storage();
    auth = firebase.auth(); // Initialize Firebase Auth
    templatesCollection = db.collection("shipmentTemplates");
    tasksCollection = db.collection("tasks"); 
    console.log("Firebase services (Firestore, Storage, Auth) obtained.");


    db.enablePersistence({synchronizeTabs:true}) 
      .then(() => console.log("Firestore offline persistence enabled."))
      .catch(err => {
        if (err.code == 'failed-precondition') {
          console.warn("Firestore offline persistence: Multiple tabs open, persistence can only be enabled in one.");
        } else if (err.code == 'unimplemented') {
          console.warn("Firestore offline persistence: Browser does not support all features required.");
        } else {
            console.error("Firestore offline persistence failed to enable:", err);
        }
      });

} catch (e) {
    console.error("CRITICAL: Error initializing Firebase. Cloud features will be unavailable.", e);
    const body = document.querySelector('body');
    if (body && !body.querySelector('.firebase-error-banner')) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'firebase-error-banner';
        errorDiv.textContent = "Critical Error: Could not connect to cloud services. Features like Templates and Tasks will be unavailable. Check configuration or contact support.";
        errorDiv.style.cssText = "background-color:darkred; color:white; padding:15px; text-align:center; position:fixed; top:0; left:0; width:100%; z-index:9999; font-size:1.1em;";
        body.prepend(errorDiv);
    }
}