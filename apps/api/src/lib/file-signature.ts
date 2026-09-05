/** 拡張子ではなく実際のバイナリ内容を確認するために読み取る先頭バイト数 */
export const FILE_SIGNATURE_CHECK_LENGTH = 12;

function startsWith(header: Buffer, bytes: number[], offset = 0): boolean {
  return header.length >= offset + bytes.length && bytes.every((b, i) => header[offset + i] === b);
}

const VALIDATORS: Record<string, (header: Buffer) => boolean> = {
  ".pdf": (h) => startsWith(h, [0x25, 0x50, 0x44, 0x46]), // %PDF
  ".png": (h) => startsWith(h, [0x89, 0x50, 0x4e, 0x47]),
  ".jpg": (h) => startsWith(h, [0xff, 0xd8, 0xff]),
  ".jpeg": (h) => startsWith(h, [0xff, 0xd8, 0xff]),
  ".mid": (h) => startsWith(h, [0x4d, 0x54, 0x68, 0x64]), // MThd
  ".midi": (h) => startsWith(h, [0x4d, 0x54, 0x68, 0x64]),
  ".wav": (h) =>
    startsWith(h, [0x52, 0x49, 0x46, 0x46]) && startsWith(h, [0x57, 0x41, 0x56, 0x45], 8), // RIFF....WAVE
  ".mp3": (h) =>
    startsWith(h, [0x49, 0x44, 0x33]) || // ID3タグ付き
    (h.length >= 2 && h[0] === 0xff && (h[1] & 0xe0) === 0xe0), // MPEGフレーム同期
};

/** 拡張子に対応するバイナリ形式か（先頭バイトのシグネチャで）判定する */
export function matchesFileSignature(ext: string, header: Buffer): boolean {
  const validator = VALIDATORS[ext];
  return validator ? validator(header) : false;
}
