const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = function uploadImage(buffer) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({
      upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
    }, (error, result) => {
      if (error) return reject(error);
      resolve(result.secure_url);
    }).end(buffer);
  });
};