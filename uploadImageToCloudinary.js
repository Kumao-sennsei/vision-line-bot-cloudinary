const axios = require("axios");
const crypto = require("crypto");

const uploadImageToCloudinary = async (base64Image) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const preset = "kumaopreset";

  const timestamp = Math.floor(Date.now() / 1000);

  const formData = {
    file: `data:image/png;base64,${base64Image}`,
    upload_preset: preset,
    api_key: apiKey,
    timestamp: timestamp,
  };

  const signature = crypto
    .createHash("sha1")
    .update(`timestamp=${timestamp}&upload_preset=${preset}${apiSecret}`)
    .digest("hex");

  formData.signature = signature;

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    new URLSearchParams(formData)
  );

  return response.data.secure_url;
};

module.exports = uploadImageToCloudinary;