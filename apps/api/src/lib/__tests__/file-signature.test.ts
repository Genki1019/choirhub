import { describe, it, expect } from "vitest";
import { matchesFileSignature } from "../file-signature.js";

describe("matchesFileSignature", () => {
  it("PDF: %PDFで始まるバッファはtrue", () => {
    expect(matchesFileSignature(".pdf", Buffer.from("%PDF-1.4"))).toBe(true);
  });

  it("PDF: 異なる内容はfalse", () => {
    expect(matchesFileSignature(".pdf", Buffer.from("not a pdf"))).toBe(false);
  });

  it("PNG: シグネチャありはtrue", () => {
    expect(matchesFileSignature(".png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe(
      true,
    );
  });

  it("JPEG: .jpg/.jpegどちらもシグネチャで判定する", () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(matchesFileSignature(".jpg", jpegHeader)).toBe(true);
    expect(matchesFileSignature(".jpeg", jpegHeader)).toBe(true);
  });

  it("MIDI: MThdで始まるバッファはtrue", () => {
    expect(matchesFileSignature(".mid", Buffer.from("MThd\x00\x00\x00\x06"))).toBe(true);
    expect(matchesFileSignature(".midi", Buffer.from("MThd\x00\x00\x00\x06"))).toBe(true);
  });

  it("MP3: ID3タグ付きはtrue", () => {
    expect(matchesFileSignature(".mp3", Buffer.from("ID3\x03\x00\x00"))).toBe(true);
  });

  it("MP3: ID3なしのMPEGフレーム同期（0xFF + 上位3bitが111）もtrue", () => {
    expect(matchesFileSignature(".mp3", Buffer.from([0xff, 0xfb, 0x90, 0x00]))).toBe(true);
  });

  it("MP3: 同期パターンに一致しない場合はfalse", () => {
    expect(matchesFileSignature(".mp3", Buffer.from([0x00, 0x00, 0x00, 0x00]))).toBe(false);
  });

  it("WAV: RIFF....WAVEの両方が揃っている場合のみtrue", () => {
    const validWav = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("WAVE"),
    ]);
    expect(matchesFileSignature(".wav", validWav)).toBe(true);
  });

  it("WAV: RIFFのみでWAVEが無い場合はfalse", () => {
    const riffOnly = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("AVI "),
    ]);
    expect(matchesFileSignature(".wav", riffOnly)).toBe(false);
  });

  it("未対応の拡張子はfalseを返す", () => {
    expect(matchesFileSignature(".docx", Buffer.from("anything"))).toBe(false);
  });

  it("ヘッダーが短すぎる場合はfalseを返す", () => {
    expect(matchesFileSignature(".pdf", Buffer.from([0x25, 0x50]))).toBe(false);
  });
});
