import { describe, expect, it } from "vitest";
import { imageSizeFromBytes } from "./imageSize";

describe("imageSizeFromBytes", () => {
  it("reads a PNG", () => {
    const b = Buffer.alloc(32);
    b.writeUInt32BE(0x89504e47, 0);
    b.writeUInt32BE(1200, 16);
    b.writeUInt32BE(800, 20);
    expect(imageSizeFromBytes(b)).toEqual({ width: 1200, height: 800 });
  });
  it("reads a GIF", () => {
    const b = Buffer.alloc(16);
    b.write("GIF89a", 0, "latin1");
    b.writeUInt16LE(40, 6);
    b.writeUInt16LE(30, 8);
    expect(imageSizeFromBytes(b)).toEqual({ width: 40, height: 30 });
  });
  it("reads a JPEG past other segments", () => {
    const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x06, 0, 0, 0, 0]); // length 6 = 2 + 4 payload bytes
    const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0x03, 0x20, 0x05, 0x00, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(imageSizeFromBytes(Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof]))).toEqual({ width: 1280, height: 800 });
  });
  it("reads WebP (VP8X and VP8L)", () => {
    const x = Buffer.alloc(32);
    x.write("RIFF", 0, "latin1");
    x.write("WEBP", 8, "latin1");
    x.write("VP8X", 12, "latin1");
    x.writeUIntLE(1599, 24, 3);
    x.writeUIntLE(899, 27, 3);
    expect(imageSizeFromBytes(x)).toEqual({ width: 1600, height: 900 });
    const l = Buffer.alloc(32);
    l.write("RIFF", 0, "latin1");
    l.write("WEBP", 8, "latin1");
    l.write("VP8L", 12, "latin1");
    // width 600, height 400 -> w-1 = 599 (0x257), h-1 = 399 (0x18F): b0=0x57, b1=(0x02)|((0x18F&3)<<6)=0xC2, b2=(0x18F>>2)&0xFF=0x63, b3=(0x18F>>10)=0
    l[21] = 0x57; l[22] = 0xc2; l[23] = 0x63; l[24] = 0x00;
    expect(imageSizeFromBytes(l)).toEqual({ width: 600, height: 400 });
  });
  it("returns null for SVG text and truncated data", () => {
    expect(imageSizeFromBytes(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(imageSizeFromBytes(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
  });
});
