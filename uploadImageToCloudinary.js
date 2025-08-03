require("dotenv").config();
const axios = require("axios");

async function uploadImageToCloudinary(base64Image) {
  try {
    const uploadPreset = "ml_default";
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    const res = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        file: `data:image/png;base64,${base64Image}`,
        upload_preset: uploadPreset,
      }
    );
    return res.data.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
}

module.exports = uploadImageToCloudinary;