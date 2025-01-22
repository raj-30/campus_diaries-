const express = require("express");
const multer = require("multer");
const firebaseAdmin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

// Firebase Admin setup
const serviceAccount = require(path.join(__dirname, "./firebaseServiceAccountKey.json"));
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  storageBucket: "campus-memories-d6a46.appspot.com" // Update with your Firebase bucket name
});

const bucket = firebaseAdmin.storage().bucket();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware
app.use(express.static("public"));
app.use(express.json());

// Upload endpoint
app.post("/upload", upload.single("photo"), async (req, res) => {
  const { category, title, description, date } = req.body;
  const photo = req.file;

  if (!photo) return res.status(400).send("No file uploaded.");

  try {
    const photoId = uuidv4();
    const file = bucket.file(`${category}/${photoId}.jpg`);

    // Save file to Firebase Storage with appropriate metadata
    await file.save(photo.buffer, { metadata: { contentType: photo.mimetype } });

    // Generate a signed URL to return to the client
    const [url] = await file.getSignedUrl({ action: "read", expires: "03-01-2030" });
    res.status(200).json({ url, category, title, description, date });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).send("Failed to upload photo");
  }
});

// Fetch all categorized photos
app.get("/photos", async (req, res) => {
  try {
    const [files] = await bucket.getFiles();
    const categorizedPhotos = await Promise.all(files.map(async (file) => {
      const [category, fileName] = file.name.split("/");

      // Get a signed URL for each file
      const [url] = await file.getSignedUrl({ action: "read", expires: "03-01-2030" });
      return { category, url };
    }));

    // Group photos by category
    const groupedPhotos = categorizedPhotos.reduce((acc, { category, url }) => {
      if (!acc[category]) acc[category] = [];
      acc[category].push(url);
      return acc;
    }, {});

    res.status(200).json(groupedPhotos);
  } catch (error) {
    console.error("Fetch photos error:", error);
    res.status(500).send("Failed to fetch photos");
  }
});

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
