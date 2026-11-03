// A tiny "stored" (uncompressed) ZIP writer and reader.
// Photos and most binary data are already compressed, so deflate would gain little.
// Writing builds a Blob out of the input Blobs themselves, so big files are
// never copied into big JS strings (that's what makes it safe on iPad memory).

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

async function toBytes(data) {
  if (typeof data === 'string') return new TextEncoder().encode(data);
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * @param {{name:string, data:Blob|Uint8Array|string}[]} files
 * @param {(done:number,total:number)=>void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function writeZip(files, onProgress) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  const { time, date } = dosDateTime(new Date());
  let i = 0;
  for (const f of files) {
    const bytes = await toBytes(f.data);
    const name = enc.encode(f.name);
    const crc = crc32(bytes);
    const size = bytes.length;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(local.buffer, name, f.data instanceof Blob ? f.data : bytes);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(cd.buffer, name);
    offset += 30 + name.length + size;
    i++;
    if (onProgress) onProgress(i, files.length);
  }
  const cdSize = central.reduce((n, p) => n + (p.byteLength ?? p.length), 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

/**
 * Read a stored ZIP. Returns a Map name -> Blob (slices of the file, so
 * nothing big is loaded until it's used). Throws on anything unexpected.
 * @param {Blob} blob
 */
export async function readZip(blob) {
  const tailLen = Math.min(blob.size, 22 + 0xffff);
  if (blob.size < 22) throw new Error('Not a zip');
  const tail = new Uint8Array(await blob.slice(blob.size - tailLen).arrayBuffer());
  let eocd = -1;
  for (let p = tail.length - 22; p >= 0; p--) {
    if (tail[p] === 0x50 && tail[p + 1] === 0x4b && tail[p + 2] === 0x05 && tail[p + 3] === 0x06) { eocd = p; break; }
  }
  if (eocd < 0) throw new Error('Not a zip');
  const ev = new DataView(tail.buffer, eocd);
  const count = ev.getUint16(10, true);
  const cdSize = ev.getUint32(12, true);
  const cdOffset = ev.getUint32(16, true);
  if (cdOffset + cdSize > blob.size) throw new Error('Damaged zip');
  const cd = new DataView(await blob.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
  const dec = new TextDecoder();
  const out = new Map();
  let p = 0;
  for (let n = 0; n < count; n++) {
    if (cd.getUint32(p, true) !== 0x02014b50) throw new Error('Damaged zip');
    const method = cd.getUint16(p + 10, true);
    const size = cd.getUint32(p + 20, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    const localOffset = cd.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    if (method !== 0) throw new Error('Compressed entries are not supported');
    const lh = new DataView(await blob.slice(localOffset, localOffset + 30).arrayBuffer());
    if (lh.getUint32(0, true) !== 0x04034b50) throw new Error('Damaged zip');
    const start = localOffset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    if (start + size > blob.size) throw new Error('Damaged zip');
    out.set(name, blob.slice(start, start + size));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
