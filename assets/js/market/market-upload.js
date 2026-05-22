(function () {
  window.KlevbyMarket = window.KlevbyMarket || {};

  const MARKET_UPLOAD_BUCKET = "market-photos";
  const MARKET_ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MARKET_ALLOWED_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  const MARKET_MAX_FILE_SIZE = 5 * 1024 * 1024;
  const MARKET_UPLOAD_MAX_DIMENSION = 1800;
  const MARKET_UPLOAD_QUALITY = 0.86;

  function getRestConfig() {
    const config = window.KLEVB_CONFIG || {};
    const supabaseUrl = String(config.SUPABASE_URL || window.SUPABASE_URL || "").trim().replace(/\/$/, "");
    const supabaseAnonKey = String(config.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || "").trim();
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return { supabaseUrl, supabaseAnonKey };
  }

  function getOutputMimeType(inputType) {
    if (inputType === "image/png") return "image/png";
    return "image/webp";
  }

  function getOutputExtension(outputMimeType) {
    return outputMimeType === "image/png" ? "png" : "webp";
  }

  function createImageBitmapFromFile(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onerror = function () {
        reject(new Error("MARKET_IMAGE_READ_FAILED"));
      };
      reader.onload = function () {
        const img = new Image();
        img.onerror = function () {
          reject(new Error("MARKET_IMAGE_DECODE_FAILED"));
        };
        img.onload = function () {
          resolve(img);
        };
        img.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  async function compressMarketImageIfPossible(file) {
    if (typeof document === "undefined") return file;
    if (typeof HTMLCanvasElement === "undefined") return file;

    try {
      const image = await createImageBitmapFromFile(file);
      const sourceWidth = Number(image.naturalWidth || image.width || 0);
      const sourceHeight = Number(image.naturalHeight || image.height || 0);
      if (!sourceWidth || !sourceHeight) return file;

      const ratio = Math.min(1, MARKET_UPLOAD_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
      const targetWidth = Math.max(1, Math.round(sourceWidth * ratio));
      const targetHeight = Math.max(1, Math.round(sourceHeight * ratio));
      const outputType = getOutputMimeType(file.type);

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d", { alpha: outputType === "image/png" });
      if (!ctx) return file;

      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

      const blob = await new Promise(function (resolve) {
        canvas.toBlob(
          function (resultBlob) {
            resolve(resultBlob || null);
          },
          outputType,
          MARKET_UPLOAD_QUALITY
        );
      });

      if (!blob) return file;
      if (blob.size >= file.size && sourceWidth <= MARKET_UPLOAD_MAX_DIMENSION && sourceHeight <= MARKET_UPLOAD_MAX_DIMENSION) {
        return file;
      }

      return new File([blob], file.name.replace(/\.[a-zA-Z0-9]+$/, "") + "." + getOutputExtension(outputType), {
        type: outputType,
        lastModified: Date.now()
      });
    } catch (error) {
      throw new Error("MARKET_IMAGE_PROCESS_FAILED");
    }
  }

  async function uploadMarketPhotoFile(params) {
    const userId = String(params?.userId || "").trim();
    const file = params?.file;
    const accessToken = String(params?.accessToken || "").trim();

    if (!userId) throw new Error("MARKET_UPLOAD_AUTH_REQUIRED");
    if (!file) throw new Error("MARKET_UPLOAD_FILE_MISSING");
    if (!accessToken) throw new Error("MARKET_UPLOAD_AUTH_REQUIRED");

    if (!MARKET_ALLOWED_INPUT_TYPES.includes(file.type)) throw new Error("MARKET_UPLOAD_TYPE_INVALID");
    if ((Number(file.size) || 0) > MARKET_MAX_FILE_SIZE) throw new Error("MARKET_UPLOAD_TOO_LARGE");

    const preparedFile = await compressMarketImageIfPossible(file);
    if (!MARKET_ALLOWED_UPLOAD_TYPES.includes(preparedFile.type)) throw new Error("MARKET_UPLOAD_TYPE_INVALID");
    if ((Number(preparedFile.size) || 0) > MARKET_MAX_FILE_SIZE) throw new Error("MARKET_UPLOAD_TOO_LARGE");

    const restConfig = getRestConfig();
    if (!restConfig) throw new Error("MARKET_UPLOAD_CONFIG_MISSING");

    const extension = getOutputExtension(preparedFile.type);
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
    const uploadUrl = `${restConfig.supabaseUrl}/storage/v1/object/${MARKET_UPLOAD_BUCKET}/${path}`;

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: restConfig.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": preparedFile.type,
        "x-upsert": "true"
      },
      body: preparedFile
    });

    if (!response.ok) {
      throw new Error(`MARKET_UPLOAD_HTTP_${response.status}`);
    }

    const publicUrl = `${restConfig.supabaseUrl}/storage/v1/object/public/${MARKET_UPLOAD_BUCKET}/${path}`;
    return { publicUrl, path, file: preparedFile };
  }

  window.KlevbyMarket.uploadMarketPhotoFile = uploadMarketPhotoFile;
  window.KlevbyMarket.MARKET_ALLOWED_TYPES = MARKET_ALLOWED_INPUT_TYPES.slice();
})();
