const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.uploadImageToCloudinary = (base64Image) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ resource_type: "image" }, (error, result) => {
      if (error) {
        console.error("❌ Cloudinary upload error:", error);
        reject(error);
      } else {
        console.log("✅ Cloudinary upload success:", result.secure_url);
        resolve(result.secure_url);
      }
    });

    const buffer = Buffer.from(base64Image, "base64");
    stream.end(buffer);
  });
};
