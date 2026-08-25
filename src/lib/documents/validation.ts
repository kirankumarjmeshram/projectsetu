export const MAX_DOCUMENT_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

export interface FileValidationResult {
  readonly valid: boolean;
  readonly mimeType: SupportedMimeType;
  readonly detectedMimeType?: string;
  readonly error?: string;
}

export function detectMimeTypeFromBuffer(
  buffer: Buffer | Uint8Array,
): string | null {
  if (!buffer || buffer.length < 4) return null;

  // PDF check: %PDF (0x25, 0x50, 0x44, 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "application/pdf";
  }

  // PNG check: 0x89, 0x50, 0x4E, 0x47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  // JPEG check: 0xFF, 0xD8, 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // WebP check: RIFF at 0..3 and WEBP at 8..11
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export function validateUploadedDocument(
  filename: string,
  content: Buffer | Uint8Array,
  declaredMimeType?: string,
  maxSizeBytes: number = MAX_DOCUMENT_UPLOAD_BYTES,
): FileValidationResult {
  if (!content || content.length === 0) {
    return {
      valid: false,
      mimeType: "application/pdf",
      error: "Uploaded file is empty.",
    };
  }

  if (content.length > maxSizeBytes) {
    const sizeMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      mimeType: "application/pdf",
      error: `File size exceeds the maximum allowed limit of ${sizeMb} MB.`,
    };
  }

  const detected = detectMimeTypeFromBuffer(content);

  // If detected by magic bytes, ensure it is supported
  if (detected) {
    if ((SUPPORTED_MIME_TYPES as readonly string[]).includes(detected)) {
      return {
        valid: true,
        mimeType: detected as SupportedMimeType,
        detectedMimeType: detected,
      };
    }
    return {
      valid: false,
      mimeType: "application/pdf",
      detectedMimeType: detected,
      error: `Unsupported file format '${detected}'. Supported formats are PDF, JPEG, PNG, and WebP.`,
    };
  }

  // Fallback to extension check if magic bytes are not matched (e.g. valid sub-types)
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    return { valid: true, mimeType: "application/pdf" };
  }
  if (ext === "jpg" || ext === "jpeg") {
    return { valid: true, mimeType: "image/jpeg" };
  }
  if (ext === "png") {
    return { valid: true, mimeType: "image/png" };
  }
  if (ext === "webp") {
    return { valid: true, mimeType: "image/webp" };
  }

  return {
    valid: false,
    mimeType: "application/pdf",
    error: `Unsupported file type '${ext || "unknown"}'. Only PDF and image files are supported.`,
  };
}
