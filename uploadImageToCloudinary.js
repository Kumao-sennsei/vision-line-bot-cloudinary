const cloudinary = require('cloudinary').v2;
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = async function(dataUri) {
  try {
    const result = await cloudinary.uploader.upload(dataUri, { folder: 'line-bot' });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};