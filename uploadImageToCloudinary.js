const axios = require("axios");

const uploadImageToCloudinary = async (base64Image) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const preset = "kumaopreset";

  const formData = {
    file: `data:image/png;base64,${base64Image}`,
    upload_preset: preset,
    api_key: apiKey,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const signature = require("crypto").createHash("sha1")
    .update(`timestamp=${formData.timestamp}&upload_preset=${preset}${apiSecret}`)
    .digest("hex");

  formData.signature = signature;

  try {
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      formData
    );
    return response.data.secure_url;
  } catch (err) {
    console.error("Cloudinaryエラー:", err);
    throw err;
  }
};

module.exports = uploadImageToCloudinary;