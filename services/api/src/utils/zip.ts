import zlib from "zlib";

// CRC32 table implementation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export const MAX_ZIP_ENTRIES = 200;
export const MAX_ZIP_ENTRY_SIZE = 50 * 1024 * 1024; // 50 MB
export const MAX_ZIP_TOTAL_UNCOMPRESSED = 100 * 1024 * 1024; // 100 MB
export const MAX_ZIP_ARCHIVE_SIZE = 100 * 1024 * 1024; // 100 MB

export class OversizedArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OversizedArchiveError";
  }
}

export interface ZipEntry {
  path: string;
  data: Buffer | string;
}

export function validateZipPath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== "string") {
    throw new Error("Invalid ZIP entry path: path cannot be empty");
  }
  if (rawPath.includes("\0")) {
    throw new Error("Invalid ZIP entry path: null bytes are forbidden");
  }
  const normalized = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/");
  for (const seg of segments) {
    if (seg === ".." || seg === "." || seg === "") {
      throw new Error(`Invalid ZIP entry path segment '${seg}' in '${rawPath}'`);
    }
  }
  return normalized;
}

/**
 * Creates a standard, fully compliant PKZIP 2.0 archive in memory with strict size limits.
 */
export function createZipArchive(entries: ZipEntry[]): Buffer {
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new OversizedArchiveError(
      `Archive exceeds maximum allowed entries limit (${entries.length} > ${MAX_ZIP_ENTRIES})`
    );
  }

  const seenPaths = new Set<string>();
  let totalUncompressed = 0;

  for (const entry of entries) {
    const validPath = validateZipPath(entry.path);
    if (seenPaths.has(validPath)) {
      throw new Error(`Duplicate ZIP entry name: ${validPath}`);
    }
    seenPaths.add(validPath);

    const rawData = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf-8");
    if (rawData.length > MAX_ZIP_ENTRY_SIZE) {
      throw new OversizedArchiveError(
        `File '${validPath}' size (${rawData.length} bytes) exceeds per-file limit of ${MAX_ZIP_ENTRY_SIZE} bytes`
      );
    }
    totalUncompressed += rawData.length;
  }

  if (totalUncompressed > MAX_ZIP_TOTAL_UNCOMPRESSED) {
    throw new OversizedArchiveError(
      `Total uncompressed payload size (${totalUncompressed} bytes) exceeds limit of ${MAX_ZIP_TOTAL_UNCOMPRESSED} bytes`
    );
  }

  const localHeaders: Buffer[] = [];
  const centralDirHeaders: Buffer[] = [];
  let offset = 0;

  // Standard DOS timestamp (fixed for deterministic export)
  const date = new Date();
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f);
  const dosDate =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0xf) << 5) |
    (date.getDate() & 0x1f);

  for (const entry of entries) {
    const cleanPath = validateZipPath(entry.path);
    const rawData = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf-8");
    const filenameBuf = Buffer.from(cleanPath, "utf-8");
    const uncompressedSize = rawData.length;
    const checksum = crc32(rawData);

    // Deflate compress data
    const compressedData = zlib.deflateRawSync(rawData, { level: 6 });
    const compressedSize = compressedData.length;

    // Local file header (30 bytes + filename + data)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local header signature
    localHeader.writeUInt16LE(20, 4);          // Version needed (2.0)
    localHeader.writeUInt16LE(0, 6);           // General purpose bit flag
    localHeader.writeUInt16LE(8, 8);           // Compression method (8 = Deflate)
    localHeader.writeUInt16LE(dosTime, 10);    // Last mod file time
    localHeader.writeUInt16LE(dosDate, 12);    // Last mod file date
    localHeader.writeUInt32LE(checksum, 14);   // CRC-32
    localHeader.writeUInt32LE(compressedSize, 18); // Compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // Uncompressed size
    localHeader.writeUInt16LE(filenameBuf.length, 26); // Filename length
    localHeader.writeUInt16LE(0, 28);          // Extra field length

    const localChunk = Buffer.concat([localHeader, filenameBuf, compressedData]);
    localHeaders.push(localChunk);

    // Central directory header (46 bytes + filename)
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0);     // Central directory signature
    cdHeader.writeUInt16LE(20, 4);             // Version made by
    cdHeader.writeUInt16LE(20, 6);             // Version needed
    cdHeader.writeUInt16LE(0, 8);              // General purpose bit flag
    cdHeader.writeUInt16LE(8, 10);             // Compression method
    cdHeader.writeUInt16LE(dosTime, 12);       // Last mod file time
    cdHeader.writeUInt16LE(dosDate, 14);       // Last mod file date
    cdHeader.writeUInt32LE(checksum, 16);      // CRC-32
    cdHeader.writeUInt32LE(compressedSize, 20); // Compressed size
    cdHeader.writeUInt32LE(uncompressedSize, 24); // Uncompressed size
    cdHeader.writeUInt16LE(filenameBuf.length, 28); // Filename length
    cdHeader.writeUInt16LE(0, 30);             // Extra field length
    cdHeader.writeUInt16LE(0, 32);             // File comment length
    cdHeader.writeUInt16LE(0, 34);             // Disk number start
    cdHeader.writeUInt16LE(0, 36);             // Internal file attributes
    cdHeader.writeUInt32LE(0, 38);             // External file attributes
    cdHeader.writeUInt32LE(offset, 42);        // Relative offset of local header

    const cdChunk = Buffer.concat([cdHeader, filenameBuf]);
    centralDirHeaders.push(cdChunk);

    offset += localChunk.length;
  }

  const centralDirBuffer = Buffer.concat(centralDirHeaders);
  const cdOffset = offset;
  const cdSize = centralDirBuffer.length;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);           // EOCD signature
  eocd.writeUInt16LE(0, 4);                    // Number of this disk
  eocd.writeUInt16LE(0, 6);                    // Disk with start of CD
  eocd.writeUInt16LE(entries.length, 8);       // Entries on this disk
  eocd.writeUInt16LE(entries.length, 10);      // Total entries
  eocd.writeUInt32LE(cdSize, 12);              // Size of central directory
  eocd.writeUInt32LE(cdOffset, 16);            // Offset of central directory
  eocd.writeUInt16LE(0, 20);                   // Comment length

  const finalArchive = Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
  if (finalArchive.length > MAX_ZIP_ARCHIVE_SIZE) {
    throw new OversizedArchiveError(
      `Final ZIP archive size (${finalArchive.length} bytes) exceeds limit of ${MAX_ZIP_ARCHIVE_SIZE} bytes`
    );
  }

  return finalArchive;
}

export interface ExtractedZipEntry {
  path: string;
  data: Buffer;
  crc32: number;
}

/**
 * Independent PKZIP 2.0 parser and extractor to verify archive integrity.
 */
export function extractZipArchive(buffer: Buffer): Map<string, Buffer> {
  const result = new Map<string, Buffer>();
  let offset = 0;

  while (offset + 4 <= buffer.length) {
    const sig = buffer.readUInt32LE(offset);
    if (sig === 0x04034b50) {
      // Local file header
      const compression = buffer.readUInt16LE(offset + 8);
      const expectedCrc = buffer.readUInt32LE(offset + 14);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const uncompressedSize = buffer.readUInt32LE(offset + 22);
      const filenameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);

      const filename = buffer.toString("utf-8", offset + 30, offset + 30 + filenameLen);
      const dataOffset = offset + 30 + filenameLen + extraLen;
      const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);

      let uncompressedData: Buffer;
      if (compression === 8) {
        uncompressedData = zlib.inflateRawSync(compressedData);
      } else if (compression === 0) {
        uncompressedData = Buffer.from(compressedData);
      } else {
        throw new Error(`Unsupported compression method ${compression} for entry ${filename}`);
      }

      if (uncompressedData.length !== uncompressedSize) {
        throw new Error(
          `Extracted size mismatch for ${filename}: expected ${uncompressedSize}, got ${uncompressedData.length}`
        );
      }

      const computedCrc = crc32(uncompressedData);
      if (computedCrc !== expectedCrc) {
        throw new Error(
          `CRC-32 checksum mismatch for ${filename}: expected ${expectedCrc.toString(16)}, got ${computedCrc.toString(16)}`
        );
      }

      result.set(filename, uncompressedData);
      offset = dataOffset + compressedSize;
    } else if (sig === 0x02014b50) {
      // Central directory header - skip
      const filenameLen = buffer.readUInt16LE(offset + 28);
      const extraLen = buffer.readUInt16LE(offset + 30);
      const commentLen = buffer.readUInt16LE(offset + 32);
      offset += 46 + filenameLen + extraLen + commentLen;
    } else if (sig === 0x06054b50) {
      // End of central directory record
      break;
    } else {
      offset++;
    }
  }

  return result;
}
