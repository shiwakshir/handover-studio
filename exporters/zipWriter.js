const zlib = require('zlib');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    crc32.table = table;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

class ZipArchive {
  constructor() {
    this.files = [];
  }

  addFile(name, content) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    this.files.push({ name: name.replace(/\\/g, '/'), data });
  }

  toBuffer() {
    const localHeaders = [];
    const centralEntries = [];
    let offset = 0;

    // Use a fixed DOS date/time (2026-11-01 12:00:00)
    // Time: (12 << 11) | (0 << 5) | (0 >> 1) = 0x6000
    // Date: ((2026 - 1980) << 9) | (11 << 5) | 1 = (46 << 9) | 352 | 1 = 23552 + 353 = 23905 = 0x5D61
    const dosTime = 0x6000;
    const dosDate = 0x5D61;

    for (const file of this.files) {
      const nameBuf = Buffer.from(file.name, 'utf8');
      const uncompressedSize = file.data.length;
      const crc = crc32(file.data);
      const deflated = zlib.deflateRawSync(file.data);
      const compressedSize = deflated.length;

      // Local File Header (30 bytes + name + data)
      const lfh = Buffer.alloc(30 + nameBuf.length);
      lfh.writeUInt32LE(0x04034b50, 0); // signature
      lfh.writeUInt16LE(20, 4);         // version needed
      lfh.writeUInt16LE(0, 6);          // flags
      lfh.writeUInt16LE(8, 8);          // compression (deflate)
      lfh.writeUInt16LE(dosTime, 10);
      lfh.writeUInt16LE(dosDate, 12);
      lfh.writeUInt32LE(crc, 14);
      lfh.writeUInt32LE(compressedSize, 18);
      lfh.writeUInt32LE(uncompressedSize, 22);
      lfh.writeUInt16LE(nameBuf.length, 26);
      lfh.writeUInt16LE(0, 28);         // extra field len
      nameBuf.copy(lfh, 30);

      const fileOffset = offset;
      localHeaders.push(lfh, deflated);
      offset += lfh.length + deflated.length;

      // Central Directory Header (46 bytes + name)
      const cdh = Buffer.alloc(46 + nameBuf.length);
      cdh.writeUInt32LE(0x02014b50, 0); // signature
      cdh.writeUInt16LE(20, 4);         // version made by
      cdh.writeUInt16LE(20, 6);         // version needed
      cdh.writeUInt16LE(0, 8);          // flags
      cdh.writeUInt16LE(8, 10);         // compression (deflate)
      cdh.writeUInt16LE(dosTime, 12);
      cdh.writeUInt16LE(dosDate, 14);
      cdh.writeUInt32LE(crc, 16);
      cdh.writeUInt32LE(compressedSize, 20);
      cdh.writeUInt32LE(uncompressedSize, 24);
      cdh.writeUInt16LE(nameBuf.length, 28);
      cdh.writeUInt16LE(0, 30);         // extra field len
      cdh.writeUInt16LE(0, 32);         // file comment len
      cdh.writeUInt16LE(0, 34);         // disk number start
      cdh.writeUInt16LE(0, 36);         // internal attrs
      cdh.writeUInt32LE(0, 38);         // external attrs
      cdh.writeUInt32LE(fileOffset, 42);// relative offset
      nameBuf.copy(cdh, 46);

      centralEntries.push(cdh);
    }

    const cdStart = offset;
    let cdSize = 0;
    for (const c of centralEntries) cdSize += c.length;

    // End of Central Directory Record (22 bytes)
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);                          // disk num
    eocd.writeUInt16LE(0, 6);                          // disk with start of cd
    eocd.writeUInt16LE(this.files.length, 8);          // entries on disk
    eocd.writeUInt16LE(this.files.length, 10);         // total entries
    eocd.writeUInt32LE(cdSize, 12);                    // size of cd
    eocd.writeUInt32LE(cdStart, 16);                   // offset of cd
    eocd.writeUInt16LE(0, 20);                         // comment length

    return Buffer.concat([...localHeaders, ...centralEntries, eocd]);
  }
}

module.exports = { ZipArchive, crc32 };
